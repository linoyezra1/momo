/**
 * Welcome Quick Reply: couple asks to add guests (ADD_GUESTS_REQUEST).
 *
 * Template button: "להכניס מוזמנים 👥" · payload ADD_GUESTS_REQUEST
 * Reply is free-text inside the 24h window; then sender link is activated
 * so shared vCards / contacts are imported to the linked event.
 */
import SystemAuditLog from "../models/SystemAuditLog.js";
import WhatsAppSenderLink from "../models/WhatsAppSenderLink.js";
import { normalizePhone } from "../utils/guestPhone.js";
import {
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import {
  extractWhatsAppButtonIdentity,
  findUsersByWhatsAppPhone
} from "./whatsappAccessDetailsService.js";
import { normalizeSenderPhone } from "./whatsappSenderAuthService.js";

export const ADD_GUESTS_ACTION_ID = "ADD_GUESTS_REQUEST";
export const ADD_GUESTS_BUTTON_TEXT = "להכניס מוזמנים";

const SUPPORT_PHONE =
  String(process.env.MOMOEVENT_SUPPORT_PHONE || "055-3193433").trim() || "055-3193433";

export const MSG_ADD_GUESTS_LISTEN =
  "איזה כיף! 🥳\n" +
  "תוכלו להכניס מוזמנים ישירות מתוך המערכת (מאנשי הקשר בנייד, בקובץ אקסל או ידנית).\n\n" +
  "מעדיפים שנעשה את זה בשבילכם?\n" +
  "אין בעיה! פשוט שתפו איתי כאן בצ'אט את אנשי הקשר";

const MSG_USER_NOT_FOUND =
  `שלום! המספר ממנו פנית אינו משויך לחשבון פעיל במערכת momoEVENT. ליצירת קשר עם התמיכה: ${SUPPORT_PHONE}.`;

function stripButtonDecorations(value) {
  return String(value || "")
    .trim()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAddGuestsRequest({ payload, text } = {}) {
  const p = String(payload || "")
    .trim()
    .toUpperCase();
  const t = String(text || "").trim();
  const plain = stripButtonDecorations(t);

  if (p === ADD_GUESTS_ACTION_ID) return true;
  if (t.toUpperCase() === ADD_GUESTS_ACTION_ID) return true;
  if (t === ADD_GUESTS_BUTTON_TEXT || plain === ADD_GUESTS_BUTTON_TEXT) return true;
  if (plain.includes("להכניס מוזמנים")) return true;
  return false;
}

async function sendSessionReply({ toPhone, body, userId }) {
  const to = toTwilioWhatsAppAddress(toPhone);
  if (!to) {
    throw new Error("invalid_whatsapp_address");
  }
  return sendTwilioWhatsAppMessage({
    to,
    body,
    userId,
    recipientPhone: toPhone
  });
}

/**
 * Ensure inbound WhatsApp sender is linked to the couple account for contact import.
 */
async function activateContactImportListenMode({ senderPhone, userId }) {
  const canonical = normalizeSenderPhone(senderPhone);
  if (!canonical || !userId) return null;

  let link = await WhatsAppSenderLink.findOne({
    senderPhone: {
      $in: [...new Set([canonical, normalizePhone(canonical)].filter(Boolean))]
    }
  }).exec();

  if (!link) {
    try {
      link = await WhatsAppSenderLink.create({
        senderPhone: canonical,
        status: "active",
        linkedUserId: userId,
        linkedEventId: userId
      });
      return link;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      link = await WhatsAppSenderLink.findOne({ senderPhone: canonical }).exec();
    }
  }

  if (!link) return null;

  link.senderPhone = canonical;
  link.status = "active";
  link.linkedUserId = userId;
  link.linkedEventId = userId;
  await link.save();
  return link;
}

async function writeAudit({ userId, phone, status = "ok", description, metadata }) {
  try {
    await SystemAuditLog.create({
      source: "WHATSAPP_QUICK_REPLY",
      action: ADD_GUESTS_ACTION_ID,
      status,
      phone: String(phone || "").trim(),
      userId: userId || null,
      description,
      metadata
    });
  } catch (error) {
    console.error(
      `[WHATSAPP] Failed to write SystemAuditLog (ADD_GUESTS): ${error?.message || error}`
    );
  }
}

/**
 * Handle ADD_GUESTS_REQUEST. Returns { handled: true, ... } when claimed.
 */
export async function handleAddGuestsRequest({
  from,
  body,
  buttonPayload,
  buttonText,
  interactiveData,
  messageSid
} = {}) {
  const { payload, text } = extractWhatsAppButtonIdentity({
    body,
    buttonPayload,
    buttonText,
    interactiveData
  });

  if (!isAddGuestsRequest({ payload, text })) {
    return { handled: false, reason: "not_add_guests" };
  }

  const inboundPhoneRaw = String(from || "").replace(/^whatsapp:/i, "").trim();
  const inboundPhoneNormalized = normalizePhone(inboundPhoneRaw);
  const inboundPhone = inboundPhoneNormalized || inboundPhoneRaw;
  const timestamp = new Date().toISOString();
  const auditMeta = {
    messageSid: messageSid || "",
    buttonPayload: payload,
    buttonText: text,
    from: from || "",
    timestamp
  };

  console.log(
    `[WHATSAPP] ADD_GUESTS_REQUEST\nphone: ${inboundPhone || "unknown"}\npayload: ${payload || "-"}\ntext: ${text || "-"}\ntimestamp: ${timestamp}`
  );

  const users = await findUsersByWhatsAppPhone(from);
  if (!users.length) {
    console.warn(
      `[WHATSAPP] ADD_GUESTS failed - user not found\nphone: ${inboundPhone || "unknown"}\ntimestamp: ${timestamp}`
    );
    await sendSessionReply({ toPhone: inboundPhoneRaw, body: MSG_USER_NOT_FOUND });
    await writeAudit({
      userId: null,
      phone: inboundPhone,
      status: "user_not_found",
      description: "ADD_GUESTS_REQUEST — user not found",
      metadata: auditMeta
    });
    return { handled: true, reason: "user_not_found", replied: true };
  }

  const user = users[0];
  const userId = user._id;

  await activateContactImportListenMode({
    senderPhone: inboundPhoneRaw,
    userId
  });

  await sendSessionReply({
    toPhone: inboundPhoneRaw,
    body: MSG_ADD_GUESTS_LISTEN,
    userId
  });

  await writeAudit({
    userId,
    phone: inboundPhone,
    status: "ok",
    description: "ADD_GUESTS_REQUEST — listen mode activated",
    metadata: { ...auditMeta, username: user.username || "" }
  });

  console.log(
    `[WHATSAPP] ADD_GUESTS listen mode on for user=${userId} phone=${inboundPhone || "unknown"}`
  );

  return {
    handled: true,
    reason: "listen_mode_activated",
    replied: true,
    userId: String(userId),
    allowContactImport: true
  };
}
