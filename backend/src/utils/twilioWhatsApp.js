import twilio from "twilio";
import { normalizePhone } from "./guestPhone.js";

const DEFAULT_MESSAGING_SERVICE_SID = "MG42b953157d0a2c06edaa8e088177c31b";

export function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID ||
        DEFAULT_MESSAGING_SERVICE_SID ||
        process.env.TWILIO_PHONE_NUMBER ||
        process.env.TWILIO_WHATSAPP_FROM)
  );
}

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured on the server");
  }
  return twilio(accountSid, authToken);
}

export function getTwilioWhatsAppFrom() {
  const raw = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_FROM || "";
  const trimmed = String(raw).trim();
  if (!trimmed) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured on the server");
  }
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  return `whatsapp:+${trimmed.replace(/\D/g, "")}`;
}

export function getTwilioMessagingServiceSid() {
  const sid = String(
    process.env.TWILIO_MESSAGING_SERVICE_SID || DEFAULT_MESSAGING_SERVICE_SID
  ).trim();
  if (!sid.startsWith("MG")) {
    throw new Error("TWILIO_MESSAGING_SERVICE_SID must start with MG");
  }
  return sid;
}

export function toTwilioWhatsAppAddress(phone) {
  const domestic = normalizePhone(phone);
  if (!domestic) return "";
  const digits = domestic.startsWith("0") ? `972${domestic.slice(1)}` : domestic.replace(/\D/g, "");
  if (!digits) return "";
  return `whatsapp:+${digits}`;
}

function toContentVariableString(value) {
  if (value == null) return "";
  return String(value);
}

/**
 * WhatsApp-approved templates reject newlines, tabs, 5+ spaces, and empty values in variables.
 * @see https://www.twilio.com/docs/api/errors/21656
 */
export function sanitizeWhatsAppTemplateVariable(value, fallback = "-") {
  let text = toContentVariableString(value)
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/!+$/u, "")
    .replace(/ {2,}/g, " ")
    .trim();

  if (!text) {
    if (fallback === "") return "";
    text = String(fallback).trim();
  }

  return text || (fallback === "" ? "" : "-");
}

const TEMPLATE_VALUE_FALLBACKS = {
  "1": "אורח/ת יקר/ה",
  "2": "משפחה וחברים יקרים, הנכם מוזמנים לחתונה שלנו",
  "3": "פרטי האירוע יתעדכנו בקרוב",
  "4": "https://momoevent.up.railway.app",
  "5": "נתראה בשמחה"
};

function extractContentVariableKeys(content) {
  const keys = new Set(Object.keys(content?.variables || {}));
  for (const typeDef of Object.values(content?.types || {})) {
    if (typeof typeDef?.body === "string") {
      for (const match of typeDef.body.matchAll(/\{\{(\d+)\}\}/g)) {
        keys.add(match[1]);
      }
    }
  }
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

export async function fetchTwilioContentTemplate(contentSid) {
  const client = getTwilioClient();
  const sid = String(contentSid || "").trim();
  if (!sid.startsWith("HX")) {
    throw new Error(`Content SID must start with HX, received: ${sid.slice(0, 8)}...`);
  }

  const content = await client.content.v1.contents(sid).fetch();
  const variableKeys = extractContentVariableKeys(content);
  if (!variableKeys.length) {
    throw new Error(`Content template ${sid} has no variable definitions`);
  }

  return {
    sid: content.sid,
    friendlyName: content.friendlyName || content.friendly_name || "unknown",
    variableKeys,
    defaultVariables: content.variables || {},
    contentTypes: Object.keys(content.types || {})
  };
}

/** Twilio Content API requires string keys ("1"…"N") and a JSON-stringified payload. */
export function buildTwilioContentVariables(
  {
    guestName,
    customOpeningText,
    eventDateTimeLocation,
    rsvpLink,
    closingSignOff
  },
  templateKeys = ["1", "2", "3", "4", "5"]
) {
  const mappedValues = {
    "1": guestName,
    "2": customOpeningText,
    "3": eventDateTimeLocation,
    "4": rsvpLink,
    "5": closingSignOff
  };

  const variables = {};
  for (const key of templateKeys) {
    variables[key] = sanitizeWhatsAppTemplateVariable(
      mappedValues[key],
      TEMPLATE_VALUE_FALLBACKS[key] || "-"
    );
  }

  return JSON.stringify(variables);
}

export function formatWhatsAppRecipientPhone(toOrPhone) {
  const raw = String(toOrPhone || "").trim();
  if (!raw) return "לא ידוע";
  return raw.replace(/^whatsapp:/i, "") || "לא ידוע";
}

export function formatWhatsAppSenderLabel({ userId, username, senderLabel } = {}) {
  if (senderLabel) return String(senderLabel).trim();
  const parts = [];
  if (userId) parts.push(String(userId));
  if (username) parts.push(String(username));
  return parts.length ? parts.join(" / ") : "לא ידוע";
}

function formatTwilioFailureReason(error) {
  if (!error) return "שגיאה לא ידועה";
  const bits = [];
  if (error.code != null && error.code !== "") bits.push(`code=${error.code}`);
  if (error.status != null && error.status !== "") bits.push(`status=${error.status}`);
  if (error.message) bits.push(String(error.message));
  else if (typeof error === "string") bits.push(error);
  return bits.join(" | ") || "שגיאה לא ידועה";
}

/**
 * Send WhatsApp via Twilio and always log SUCCESS / ERROR for Railway console tracing.
 * Optional context: userId, username, senderLabel, recipientPhone
 */
export async function sendTwilioWhatsAppMessage({
  to,
  body,
  contentSid,
  contentVariables,
  userId,
  username,
  senderLabel,
  recipientPhone
}) {
  const displayPhone = formatWhatsAppRecipientPhone(recipientPhone || to);
  const displaySender = formatWhatsAppSenderLabel({ userId, username, senderLabel });

  try {
    const client = getTwilioClient();
    const messagingServiceSid = getTwilioMessagingServiceSid();
    let result;
    if (contentSid) {
      const messagePayload = {
        to,
        contentSid,
        messagingServiceSid
      };
      if (contentVariables != null) {
        messagePayload.contentVariables =
          typeof contentVariables === "string"
            ? contentVariables
            : buildTwilioContentVariables(contentVariables);
      }
      result = await client.messages.create(messagePayload);
    } else {
      result = await client.messages.create({ body, messagingServiceSid, to });
    }

    console.log(
      `SUCCESS: וואטסאפ נשלח בהצלחה למספר ${displayPhone} מאת משתמש ${displaySender}`
    );
    return result;
  } catch (error) {
    const reason = formatTwilioFailureReason(error);
    console.error(
      `ERROR: שליחת וואטסאפ נכשלה למספר ${displayPhone} מאת משתמש ${displaySender}. סיבה: ${reason}`
    );
    throw error;
  }
}

