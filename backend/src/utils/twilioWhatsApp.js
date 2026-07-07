import twilio from "twilio";
import { normalizePhone } from "./guestPhone.js";

export function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_FROM)
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
    .replace(/\r\n/g, "\n")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();

  if (!text) {
    if (fallback === "") return "";
    text = String(fallback).trim();
  }

  return text || (fallback === "" ? "" : "-");
}

/** Twilio Content API requires string keys ("1"…"5") and a JSON-stringified payload. */
export function buildTwilioContentVariables({
  guestName,
  customOpeningText,
  eventDateTimeLocation,
  rsvpLink,
  closingSignOff
}) {
  const variables = {
    "1": sanitizeWhatsAppTemplateVariable(guestName, "אורח/ת יקר/ה"),
    "2": sanitizeWhatsAppTemplateVariable(
      customOpeningText,
      "משפחה וחברים יקרים, הנכם מוזמנים לאירוע שלנו"
    ),
    "3": sanitizeWhatsAppTemplateVariable(eventDateTimeLocation, "פרטי האירוע יתעדכנו בקרוב"),
    "4": sanitizeWhatsAppTemplateVariable(rsvpLink, "https://momoevent.up.railway.app")
  };

  const signature = sanitizeWhatsAppTemplateVariable(closingSignOff, "");
  if (signature && signature !== "-") {
    variables["5"] = signature;
  }

  return JSON.stringify(variables);
}

export async function sendTwilioWhatsAppMessage({ to, body, contentSid, contentVariables }) {
  const client = getTwilioClient();
  const from = getTwilioWhatsAppFrom();
  if (contentSid) {
    const serializedVariables =
      typeof contentVariables === "string" ? contentVariables : buildTwilioContentVariables(contentVariables || {});
    return client.messages.create({
      from,
      to,
      contentSid,
      contentVariables: serializedVariables
    });
  }
  return client.messages.create({ body, from, to });
}
