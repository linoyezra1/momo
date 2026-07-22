/**
 * Day-of table-number WhatsApp (Meta Content Template).
 *
 * Body (he / UTILITY):
 * שלום {{1}}, תודה שהגעתם ל{{2}} שלנו! הנכם יושבים בשולחן {{3}}. אוהבים, {{4}}
 *
 * {{1}} guest name
 * {{2}} event type (חתונה / ברית / …)
 * {{3}} table label
 * {{4}} hosts / couple names
 */
import {
  buildTwilioContentVariables,
  isTwilioConfigured,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

const TABLE_NUMBER_CONTENT_SID_DEFAULT = "";

export function getTableNumberContentSid() {
  return String(
    process.env.TWILIO_TABLE_NUMBER_CONTENT_SID || TABLE_NUMBER_CONTENT_SID_DEFAULT || ""
  ).trim();
}

export function buildEventHostsLabel(event = {}) {
  if (!event) return "המארחים";
  if (event.eventType === "חתונה") {
    const groom = String(event.groomName || "").trim();
    const bride = String(event.brideName || "").trim();
    if (groom && bride) return `${groom} ו${bride}`;
    return groom || bride || "המארחים";
  }
  if (event.eventType === "ברית") {
    const p1 = String(event.parentName1 || "").trim();
    const p2 = String(event.parentName2 || "").trim();
    if (p1 && p2) return `${p1} ו${p2}`;
    return p1 || p2 || "המארחים";
  }
  if (event.eventType === "בת מצווה") {
    return String(event.parentName1 || event.batMitzvahName || "המארחים").trim() || "המארחים";
  }
  return String(event.eventNames || "המארחים").trim() || "המארחים";
}

export function buildTableNumberContentVariables({ guestName, eventType, tableLabel, hostsLabel }) {
  return buildTwilioContentVariables({
    1: String(guestName || "אורח/ת").trim() || "אורח/ת",
    2: String(eventType || "אירוע").trim() || "אירוע",
    3: String(tableLabel || "?").trim() || "?",
    4: String(hostsLabel || "המארחים").trim() || "המארחים"
  });
}

export function buildTableNumberFreeText({ guestName, eventType, tableLabel, hostsLabel }) {
  const name = String(guestName || "אורח/ת").trim() || "אורח/ת";
  const type = String(eventType || "אירוע").trim() || "אירוע";
  const table = String(tableLabel || "?").trim() || "?";
  const hosts = String(hostsLabel || "המארחים").trim() || "המארחים";
  return `שלום ${name}, תודה שהגעתם ל${type} שלנו! הנכם יושבים בשולחן ${table}. אוהבים, ${hosts}`;
}

export function canSendTableWhatsApp(user) {
  const features = user?.deal?.includedFeatures || {};
  if (typeof features.canSendTableWhatsApp === "boolean") {
    return features.canSendTableWhatsApp;
  }
  return features.eventDayTableNumber !== false;
}

/**
 * Send one table-number WhatsApp to a seated guest.
 */
export async function sendTableNumberWhatsApp({ user, guest, tableLabel }) {
  if (!isTwilioConfigured()) {
    return { ok: false, reason: "twilio_not_configured", message: "שירות שליחת הודעות לא מוגדר בשרת" };
  }

  const to = toTwilioWhatsAppAddress(guest?.phone);
  if (!to) {
    return { ok: false, reason: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const event = user?.event || {};
  const guestName = String(guest.fullName || "").trim().split(/\s+/)[0] || guest.fullName || "אורח/ת";
  const eventType = String(event.eventType || "אירוע").trim() || "אירוע";
  const hostsLabel = buildEventHostsLabel(event);
  const label = String(tableLabel || "?").trim() || "?";

  const contentSid = getTableNumberContentSid();
  const allowFreeText = String(process.env.TWILIO_TABLE_NUMBER_ALLOW_FREE_TEXT || "").toLowerCase() === "true";

  try {
    if (contentSid) {
      await sendTwilioWhatsAppMessage({
        to,
        contentSid,
        contentVariables: buildTableNumberContentVariables({
          guestName,
          eventType,
          tableLabel: label,
          hostsLabel
        }),
        userId: user?._id,
        recipientPhone: guest.phone
      });
    } else if (allowFreeText) {
      await sendTwilioWhatsAppMessage({
        to,
        body: buildTableNumberFreeText({
          guestName,
          eventType,
          tableLabel: label,
          hostsLabel
        }),
        userId: user?._id,
        recipientPhone: guest.phone
      });
    } else {
      return {
        ok: false,
        reason: "template_missing",
        message: "חסר TWILIO_TABLE_NUMBER_CONTENT_SID (תבנית Meta מאושרת למספר שולחן)"
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "send_failed",
      message: error?.message || "שליחת ההודעה נכשלה",
      error
    };
  }
}
