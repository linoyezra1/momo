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

/** Twilio Content API requires string keys ("1"…"5") and a JSON-stringified payload. */
export function buildTwilioContentVariables({
  guestName,
  customOpeningText,
  eventDateTimeLocation,
  rsvpLink,
  closingSignOff
}) {
  return JSON.stringify({
    "1": toContentVariableString(guestName),
    "2": toContentVariableString(customOpeningText),
    "3": toContentVariableString(eventDateTimeLocation),
    "4": toContentVariableString(rsvpLink),
    "5": toContentVariableString(closingSignOff)
  });
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
