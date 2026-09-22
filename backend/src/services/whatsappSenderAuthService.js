/**
 * Stateful WhatsApp sender onboarding: link a sender phone → couple User/event.
 */
import User from "../models/User.js";
import WhatsAppSenderLink from "../models/WhatsAppSenderLink.js";
import {
  hasUsablePhoneDigits,
  isValidIsraeliMobilePhone
} from "../utils/guestImport.js";
import { normalizePhone, phoneLookupVariants } from "../utils/guestPhone.js";
import { getEventTypeNoun, isCoupleEventType } from "../utils/eventTypeWording.js";
import {
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import { extractTwilioVcardMedia } from "../utils/vcardParse.js";

export const MSG_WELCOME =
  "ברוכים הבאים ל-momo אישורי הגעה! ✨\n" +
  "לאיזה חשבון לרשום את המוזמנים?\n" +
  "אנא השב/י עם מספר הטלפון של הכלה/החתן/בעלי האירוע.";

function buildNotFoundMessage(phone) {
  const shown = String(phone || "").trim() || "שנשלח";
  return (
    `לא מצאנו אירוע המשויך למספר שהזנת (${shown}). אנא נסה/י שוב עם המספר המדויק.`
  );
}

function buildSuccessMessage(eventName) {
  return (
    `מעולה! החשבון זוהה בהצלחה עבור האירוע של ${eventName} 🎉\n` +
    "מעכשיו ניתן לשתף לכאן אנשי קשר."
  );
}

const MSG_PENDING_NEED_PHONE =
  "קיבלנו את ההודעה 🙂\n" +
  "אנא שלח/י את מספר הטלפון המלא של הכלה/החתן/בעלי האירוע (לדוגמה: 05XXXXXXXX).";

function eventDisplayLabel(event = {}) {
  if (isCoupleEventType(event.eventType)) {
    const groom = String(event.groomName || "").trim();
    const bride = String(event.brideName || "").trim();
    const noun = getEventTypeNoun(event.eventType);
    if (groom && bride) return `${groom} ו${bride}`;
    return bride || groom || noun;
  }
  if (event.eventType === "ברית") {
    const names = [event.parentName1, event.parentName2]
      .map((n) => String(n || "").trim())
      .filter(Boolean);
    return names.length ? names.join(" ו") : "ברית";
  }
  if (event.eventType === "בר מצווה" || event.eventType === "בת מצווה") {
    return String(event.batMitzvahName || event.parentName1 || event.eventType).trim() || event.eventType;
  }
  return String(event.eventNames || event.conferenceBrandName || event.eventType || "האירוע").trim();
}

/** Canonical Israeli local form for storage + lookup (05XXXXXXXX). */
export function normalizeSenderPhone(fromOrPhone) {
  const raw = String(fromOrPhone || "")
    .trim()
    .replace(/^whatsapp:/i, "");
  const normalized = normalizePhone(raw);
  if (normalized) return normalized;

  // Fallback: keep digits only so lookup still works across formats
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 11) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("5") && digits.length === 9) {
    return `0${digits}`;
  }
  return digits;
}

function senderPhoneLookupValues(senderPhone) {
  const canonical = normalizeSenderPhone(senderPhone);
  return [...new Set([canonical, ...phoneLookupVariants(canonical)].filter(Boolean))];
}

function isResetCommand(text) {
  const raw = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[!.]/g, "");
  const compact = raw.replace(/\s+/g, "");
  return (
    raw === "החלף חשבון" ||
    compact === "החלףחשבון" ||
    raw === "איפוס" ||
    compact === "איפוס" ||
    raw === "reset" ||
    raw === "unlink"
  );
}

/**
 * Extract a phone candidate from free text (digits / Israeli mobile).
 */
export function extractAccountPhoneCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const digitsHeavy = raw.replace(/[^\d+]/g, "");
  const direct = normalizePhone(digitsHeavy || raw);
  if (direct && (isValidIsraeliMobilePhone(direct) || hasUsablePhoneDigits(direct))) {
    return direct;
  }

  const matches = raw.match(/(\+?972[\d\-\s]{8,}|\b0?5\d[\d\-\s]{7,}|\b\d{9,12}\b)/g) || [];
  for (const match of matches) {
    const normalized = normalizePhone(match);
    if (normalized && (isValidIsraeliMobilePhone(normalized) || hasUsablePhoneDigits(normalized))) {
      return normalized;
    }
  }
  return "";
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

async function findUsersByContactPhone(accountPhone) {
  const normalized = normalizePhone(accountPhone);
  if (!normalized) return [];

  const variants = phoneLookupVariants(normalized);
  const national = normalized.startsWith("0") ? normalized.slice(1) : normalized;

  const candidates = await User.find({
    $or: [
      { contactPhone: { $in: variants } },
      ...(national.length >= 8 ? [{ contactPhone: { $regex: `${national}$` } }] : [])
    ]
  })
    .select(
      "username contactPhone event.eventType event.groomName event.brideName event.parentName1 event.parentName2 event.batMitzvahName event.eventNames event.conferenceBrandName event.eventDate createdAt"
    )
    .lean()
    .exec();

  return candidates.filter((user) => {
    const saved = normalizePhone(user.contactPhone);
    return Boolean(saved) && saved === normalized;
  });
}

function pickBestUserForLink(users) {
  if (!users?.length) return null;
  if (users.length === 1) return users[0];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const scored = users.map((user) => {
    const rawDate = user?.event?.eventDate;
    const ts = rawDate ? new Date(rawDate).getTime() : NaN;
    return { user, ts };
  });

  const upcoming = scored
    .filter((row) => Number.isFinite(row.ts) && row.ts >= now - dayMs)
    .sort((a, b) => a.ts - b.ts);
  if (upcoming.length) return upcoming[0].user;

  const withDate = scored.filter((row) => Number.isFinite(row.ts)).sort((a, b) => b.ts - a.ts);
  if (withDate.length) return withDate[0].user;

  return users[0];
}

/**
 * Find existing link across phone format variants; always persist canonical senderPhone.
 */
async function findSenderLink(senderPhone) {
  const canonical = normalizeSenderPhone(senderPhone);
  const variants = senderPhoneLookupValues(canonical);
  const link = await WhatsAppSenderLink.findOne({
    senderPhone: { $in: variants }
  }).exec();

  if (link && link.senderPhone !== canonical) {
    link.senderPhone = canonical;
    try {
      await link.save();
    } catch (error) {
      // Unique race — keep existing doc
      console.warn("[WhatsApp auth] Could not canonicalize senderPhone:", error?.message || error);
    }
  }
  return link;
}

async function getOrCreateSenderLink(senderPhone) {
  const canonical = normalizeSenderPhone(senderPhone);
  let link = await findSenderLink(canonical);
  if (link) return { link, created: false, canonical };

  try {
    link = await WhatsAppSenderLink.create({
      senderPhone: canonical,
      status: "pending_auth",
      linkedUserId: null,
      linkedEventId: null
    });
    return { link, created: true, canonical };
  } catch (error) {
    // Duplicate key from race / format mismatch — re-fetch
    if (error?.code === 11000) {
      link = await findSenderLink(canonical);
      if (link) return { link, created: false, canonical };
    }
    throw error;
  }
}

/**
 * Gate inbound WhatsApp through sender auth state.
 * Returns { handled, link, allowContactImport }.
 */
export async function handleWhatsAppSenderAuth(reqBody = {}) {
  const from = String(reqBody.From || "").trim();
  const inboundPhoneRaw = from.replace(/^whatsapp:/i, "").trim();
  const senderPhone = normalizeSenderPhone(from);
  const bodyText = String(reqBody.Body || reqBody.ButtonText || "").trim();
  const hasVcard = extractTwilioVcardMedia(reqBody).length > 0;

  if (!senderPhone) {
    console.log("[Auth Debug] Sender: (empty) Found Link: null IncomingText:", bodyText);
    return { handled: false, reason: "invalid_sender", allowContactImport: false };
  }

  const { link, created, canonical } = await getOrCreateSenderLink(senderPhone);

  console.log(
    `[Auth Debug] Sender: ${canonical} Found Link: ${link?.status || "null"} IncomingText: ${bodyText}`
  );

  // —— Brand new sender only ——
  if (created) {
    await sendReply({ toPhone: inboundPhoneRaw, body: MSG_WELCOME });
    console.log(
      `[WhatsApp auth] New sender ${canonical} → pending_auth (vcardIgnored=${hasVcard})`
    );
    return {
      handled: true,
      reason: "welcome_sent",
      allowContactImport: false,
      link
    };
  }

  // —— Reset command ——
  if (isResetCommand(bodyText)) {
    link.status = "pending_auth";
    link.linkedUserId = null;
    link.linkedEventId = null;
    link.senderPhone = canonical;
    await link.save();
    await sendReply({ toPhone: inboundPhoneRaw, body: MSG_WELCOME });
    console.log(`[WhatsApp auth] Sender ${canonical} reset → pending_auth`);
    return {
      handled: true,
      reason: "reset",
      allowContactImport: false,
      link
    };
  }

  // —— Existing pending_auth: expect account phone (never re-send welcome) ——
  if (link.status === "pending_auth") {
    const accountPhone = extractAccountPhoneCandidate(bodyText);
    console.log(
      `[Auth Debug] pending_auth extract phone from "${bodyText}" → "${accountPhone || "(none)"}"`
    );

    if (!accountPhone) {
      await sendReply({
        toPhone: inboundPhoneRaw,
        body: MSG_PENDING_NEED_PHONE
      });
      return {
        handled: true,
        reason: hasVcard ? "pending_vcard_blocked" : "pending_need_phone",
        allowContactImport: false,
        link
      };
    }

    const users = await findUsersByContactPhone(accountPhone);
    const user = pickBestUserForLink(users);
    if (!user) {
      await sendReply({
        toPhone: inboundPhoneRaw,
        body: buildNotFoundMessage(accountPhone)
      });
      return {
        handled: true,
        reason: "account_not_found",
        allowContactImport: false,
        link,
        accountPhone
      };
    }

    link.status = "active";
    link.linkedUserId = user._id;
    link.linkedEventId = user._id;
    link.senderPhone = canonical;
    await link.save();

    const eventName = eventDisplayLabel(user.event || {});
    await sendReply({
      toPhone: inboundPhoneRaw,
      body: buildSuccessMessage(eventName),
      userId: user._id
    });
    console.log(
      `[WhatsApp auth] Sender ${canonical} linked → user=${user._id} (${eventName})`
    );
    return {
      handled: true,
      reason: "linked",
      allowContactImport: false,
      link,
      userId: String(user._id)
    };
  }

  // —— Active ——
  if (link.status === "active" && link.linkedUserId) {
    if (link.senderPhone !== canonical) {
      link.senderPhone = canonical;
      await link.save().catch(() => {});
    }
    if (hasVcard) {
      return {
        handled: false,
        reason: "active_allow_import",
        allowContactImport: true,
        link
      };
    }
    return {
      handled: false,
      reason: "active_passthrough",
      allowContactImport: false,
      link
    };
  }

  // Corrupt state → re-auth once
  link.status = "pending_auth";
  link.linkedUserId = null;
  link.linkedEventId = null;
  link.senderPhone = canonical;
  await link.save();
  await sendReply({ toPhone: inboundPhoneRaw, body: MSG_WELCOME });
  return {
    handled: true,
    reason: "reauth_required",
    allowContactImport: false,
    link
  };
}
