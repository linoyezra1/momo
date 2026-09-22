/**
 * Inbound WhatsApp: couple shares a contact (vCard) → create guest on their event.
 */
import Guest from "../models/Guest.js";
import {
  buildGuestCreatedDescription,
  recordGuestAuditLog
} from "./guestAuditService.js";
import { publishDashboardEvent } from "./dashboardEvents.js";
import { findUsersByWhatsAppPhone } from "./whatsappAccessDetailsService.js";
import {
  extractTwilioVcardMedia,
  parseVcardContacts
} from "../utils/vcardParse.js";
import {
  hasUsablePhoneDigits,
  isValidIsraeliMobilePhone
} from "../utils/guestImport.js";
import { normalizePhone } from "../utils/guestPhone.js";
import {
  initialStatusHistoryEntry,
  STATUS_HISTORY_SOURCES
} from "../utils/guestStatusHistory.js";
import {
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

function looksLikeVcard(text) {
  return /BEGIN:VCARD/i.test(String(text || ""));
}

function looksLikeTwilioMediaXml(text) {
  const raw = String(text || "").trim();
  return (
    raw.startsWith("<?xml") ||
    raw.includes("<TwilioResponse>") ||
    raw.includes("<Media>")
  );
}

function basicAuthHeader(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function resolveRedirectUrl(baseUrl, location) {
  const loc = String(location || "").trim();
  if (!loc) return "";
  try {
    return new URL(loc, baseUrl).toString();
  } catch {
    return loc;
  }
}

/**
 * Twilio MediaUrl returns 307 → temporary S3 URL.
 * Do NOT forward Authorization to S3 (causes XML/metadata or rejection).
 * Flow: auth request with redirect:manual → GET Location without auth.
 */
async function downloadTwilioMediaAsText(mediaUrl) {
  const url = String(mediaUrl || "").trim();
  if (!url) {
    throw new Error("media_url_missing");
  }

  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!accountSid || !authToken) {
    throw new Error("twilio_credentials_missing");
  }

  const authHeader = basicAuthHeader(accountSid, authToken);
  const acceptHeader = "text/vcard, text/x-vcard, text/directory, text/plain, */*";

  const first = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Accept: acceptHeader
    },
    redirect: "manual"
  });

  let binaryResponse = null;

  if (first.status >= 300 && first.status < 400) {
    const location = resolveRedirectUrl(url, first.headers.get("location"));
    if (!location) {
      throw new Error(`media_redirect_missing_location_${first.status}`);
    }
    console.log(
      `[WhatsApp contacts] Twilio media redirect ${first.status} → ${location.slice(0, 80)}…`
    );
    binaryResponse = await fetch(location, {
      method: "GET",
      headers: { Accept: acceptHeader },
      redirect: "follow"
    });
  } else if (first.ok) {
    binaryResponse = first;
  } else {
    throw new Error(`media_download_failed_${first.status}`);
  }

  if (!binaryResponse.ok) {
    throw new Error(`media_download_failed_${binaryResponse.status}`);
  }

  let text = await binaryResponse.text();

  // If we still got API XML metadata, try the Uri from the payload (then redirect again).
  if (looksLikeTwilioMediaXml(text) && !looksLikeVcard(text)) {
    console.warn(
      "[WhatsApp contacts] Received Twilio Media XML instead of vCard — retrying via Media Uri"
    );
    const uriMatch = text.match(/<Uri>([^<]+)<\/Uri>/i);
    const mediaUri = String(uriMatch?.[1] || "").trim();
    if (mediaUri) {
      const retryUrl = mediaUri.startsWith("http")
        ? mediaUri
        : `https://api.twilio.com${mediaUri.startsWith("/") ? "" : "/"}${mediaUri}`;
      const retryFirst = await fetch(retryUrl, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: acceptHeader
        },
        redirect: "manual"
      });
      if (retryFirst.status >= 300 && retryFirst.status < 400) {
        const location = resolveRedirectUrl(retryUrl, retryFirst.headers.get("location"));
        if (!location) {
          throw new Error("media_retry_redirect_missing_location");
        }
        const retryBinary = await fetch(location, {
          method: "GET",
          headers: { Accept: acceptHeader },
          redirect: "follow"
        });
        if (!retryBinary.ok) {
          throw new Error(`media_retry_download_failed_${retryBinary.status}`);
        }
        text = await retryBinary.text();
      } else if (retryFirst.ok) {
        text = await retryFirst.text();
      }
    }
  }

  if (!looksLikeVcard(text)) {
    const preview = String(text || "").replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      `media_not_vcard: expected BEGIN:VCARD, got: ${preview || "(empty)"}`
    );
  }

  return text;
}

async function sendReply({ toPhone, body, userId }) {
  const to = toTwilioWhatsAppAddress(toPhone);
  if (!to) return null;
  return sendTwilioWhatsAppMessage({
    to,
    body,
    userId,
    recipientPhone: toPhone
  });
}

async function createGuestFromContact({ userId, fullName, phone }) {
  const guest = await Guest.create({
    userId,
    fullName,
    phone,
    attendeesCount: 1,
    giftAmount: 0,
    status: "לא ידוע",
    source: "contacts",
    guestGroup: "",
    statusHistory: [
      initialStatusHistoryEntry({
        status: "לא ידוע",
        updatedBy: "הזוג (שיתוף איש קשר בוואטסאפ)",
        source: STATUS_HISTORY_SOURCES.COUPLE,
        note: "ייבוא מכרטיס איש קשר בוואטסאפ"
      })
    ]
  });

  await recordGuestAuditLog({
    userId,
    guestId: guest._id,
    guestName: guest.fullName,
    guestPhone: guest.phone,
    actor: "client",
    channel: "whatsapp",
    action: "guest_created",
    description: buildGuestCreatedDescription(guest),
    metadata: { source: "whatsapp_vcard" },
    changes: {
      status: { to: guest.status },
      attendeesCount: { to: guest.attendeesCount }
    }
  });

  publishDashboardEvent(userId, {
    type: "guest-created",
    guestId: String(guest._id)
  });

  return guest;
}

/**
 * Handle inbound WhatsApp vCard media for an authenticated sender link.
 * @param {object} reqBody
 * @param {{ linkedUserId?: import("mongoose").Types.ObjectId, linkedEventId?: import("mongoose").Types.ObjectId } | null} senderLink
 */
export async function handleIncomingWhatsAppContactShare(reqBody = {}, senderLink = null) {
  const vcardMedia = extractTwilioVcardMedia(reqBody);
  if (!vcardMedia.length) {
    return { handled: false, reason: "no_vcard_media" };
  }

  const from = String(reqBody.From || "").trim();
  const inboundPhoneRaw = from.replace(/^whatsapp:/i, "").trim();

  let userId = senderLink?.linkedUserId || senderLink?.linkedEventId || null;
  if (!userId) {
    const users = await findUsersByWhatsAppPhone(from);
    userId = users[0]?._id || null;
  }

  if (!userId) {
    await sendReply({
      toPhone: inboundPhoneRaw,
      body:
        "קיבלנו איש קשר, אבל עדיין לא קושר חשבון למספר הזה.\n" +
        "שלחו את מספר הטלפון של בעלי האירוע לקישור, ואז שתפו שוב את איש הקשר."
    });
    return { handled: true, reason: "sender_not_linked", imported: 0 };
  }

  const parsedContacts = [];

  for (const media of vcardMedia) {
    try {
      const raw = await downloadTwilioMediaAsText(media.url);
      const contacts = parseVcardContacts(raw);
      parsedContacts.push(...contacts);
      console.log(
        `[WhatsApp contacts] media#${media.index} parsed=${contacts.length} ` +
          `type=${media.contentType} sid=${reqBody.MessageSid || "-"}`
      );
    } catch (error) {
      console.error(
        `[WhatsApp contacts] Failed to download/parse media#${media.index}:`,
        error?.message || error
      );
    }
  }

  if (!parsedContacts.length) {
    await sendReply({
      toPhone: inboundPhoneRaw,
      body: "קיבלנו את הקובץ, אבל לא הצלחנו לקרוא שם ומספר טלפון מאיש הקשר. נסו לשתף שוב או להוסיף ידנית בדשבורד.",
      userId
    });
    return { handled: true, reason: "parse_empty", imported: 0, userId: String(userId) };
  }

  const imported = [];
  const skipped = [];
  const failed = [];
  const seen = new Set();

  for (const contact of parsedContacts) {
    const fullName = String(contact.fullName || "").trim();
    const normalizedPhone = normalizePhone(contact.phone);

    if (!fullName || !normalizedPhone) {
      failed.push({ fullName, phone: contact.phone || "", reason: "missing_fields" });
      continue;
    }
    if (!isValidIsraeliMobilePhone(normalizedPhone) && !hasUsablePhoneDigits(normalizedPhone)) {
      failed.push({ fullName, phone: normalizedPhone, reason: "invalid_phone" });
      continue;
    }
    if (seen.has(normalizedPhone)) {
      skipped.push({ fullName, phone: normalizedPhone, reason: "duplicate_in_payload" });
      continue;
    }
    seen.add(normalizedPhone);

    const existing = await Guest.findOne({ userId, phone: normalizedPhone }).select("_id fullName");
    if (existing) {
      skipped.push({
        fullName: existing.fullName || fullName,
        phone: normalizedPhone,
        reason: "already_exists"
      });
      continue;
    }

    try {
      const guest = await createGuestFromContact({
        userId,
        fullName,
        phone: normalizedPhone
      });
      console.log(`[WhatsApp Import] Saved guest ${guest.fullName} to event ${userId}`);
      imported.push({
        id: String(guest._id),
        fullName: guest.fullName,
        phone: guest.phone
      });
    } catch (error) {
      failed.push({
        fullName,
        phone: normalizedPhone,
        reason: error?.message || "create_failed"
      });
    }
  }

  let replyBody = "";
  if (imported.length === 1) {
    replyBody = `מעולה! הוספנו את ${imported[0].fullName} לרשימת המוזמנים (סטטוס: לא ידוע, כמות: 1).`;
  } else if (imported.length > 1) {
    const names = imported.map((row) => row.fullName).join(", ");
    replyBody = `מעולה! הוספנו ${imported.length} מוזמנים לרשימה: ${names}.`;
  } else if (skipped.length && skipped.every((row) => row.reason === "already_exists")) {
    const name = skipped[0]?.fullName || "איש הקשר";
    replyBody =
      skipped.length === 1
        ? `${name} כבר קיים/ה ברשימת המוזמנים — לא ביצענו כפילות.`
        : `אנשי הקשר ששלחתם כבר קיימים ברשימה — לא נוספו כפילויות.`;
  } else {
    replyBody =
      "קיבלנו את איש הקשר אבל לא הצלחנו להוסיף מוזמן חדש. בדקו שיש שם ומספר טלפון תקינים, או הוסיפו ידנית בדשבורד.";
  }

  if (imported.length && skipped.some((row) => row.reason === "already_exists")) {
    replyBody += `\n(${skipped.filter((row) => row.reason === "already_exists").length} דולגו כי כבר קיימים)`;
  }

  await sendReply({ toPhone: inboundPhoneRaw, body: replyBody, userId });

  return {
    handled: true,
    reason: "ok",
    userId: String(userId),
    importedCount: imported.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    imported,
    skipped,
    failed
  };
}
