/**
 * Day-of table-number WhatsApp (Meta Content Template).
 *
 * Friendly name: copy_event_table_number_utility
 * Content SID: HX405726f9479a1d07e2fe8fcbe77a6be4
 * Language: he · Category: UTILITY · Type: Text
 *
 * Body:
 * ✨ 🥂 ✨
 *
 * שלום {{1}},
 *
 * תודה שהגעתם ל{{2}}!
 *
 * השולחן שלכם הוא:
 * {{3}}
 *
 * מחכים לחגוג איתכם,
 * {{4}}
 *
 * ✨ 🥂 ✨
 *
 * {{1}} guest full name     sample: יצחק כהן
 * {{2}} event type          sample: חתונה
 * {{3}} table assignment    sample: חברות שולחן מס 12
 * {{4}} hosts / couple      sample: לינוי ויצחק
 */
import {
  isTwilioConfigured,
  sanitizeWhatsAppTemplateVariable,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import { isCoupleEventType } from "../utils/eventTypeWording.js";

const TABLE_NUMBER_CONTENT_SID_DEFAULT = "HX405726f9479a1d07e2fe8fcbe77a6be4";

export function getTableNumberContentSid() {
  return String(
    process.env.TWILIO_TABLE_NUMBER_CONTENT_SID || TABLE_NUMBER_CONTENT_SID_DEFAULT || ""
  ).trim();
}

/** WhatsApp {{3}} line: "חברות שולחן מס 12" or "שולחן מס 12" when name is empty. */
export function formatTableWhatsAppLine(table = {}, fallbackLabel = "") {
  const number = String(table?.label || fallbackLabel || "").trim() || "?";
  const name = String(table?.name || "").trim();
  if (name) return `${name} שולחן מס ${number}`;
  return `שולחן מס ${number}`;
}

/** Short UI label: "חברות · 12" / "12". */
export function formatTableDisplayLabel(table = {}, fallbackLabel = "") {
  const number = String(table?.label || fallbackLabel || "").trim();
  const name = String(table?.name || "").trim();
  if (name && number) return `${name} · ${number}`;
  return name || number || "?";
}

export function buildEventHostsLabel(event = {}) {
  if (!event) return "המארחים";
  if (isCoupleEventType(event.eventType)) {
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
  if (event.eventType === "בר מצווה" || event.eventType === "בת מצווה") {
    return String(event.parentName1 || event.batMitzvahName || "המארחים").trim() || "המארחים";
  }
  return String(event.eventNames || "המארחים").trim() || "המארחים";
}

export function buildTableNumberContentVariables({ guestName, eventType, tableLabel, hostsLabel }) {
  return JSON.stringify({
    "1": sanitizeWhatsAppTemplateVariable(guestName, "אורח/ת"),
    "2": sanitizeWhatsAppTemplateVariable(eventType, "אירוע"),
    "3": sanitizeWhatsAppTemplateVariable(tableLabel, "?"),
    "4": sanitizeWhatsAppTemplateVariable(hostsLabel, "המארחים")
  });
}

export function buildTableNumberFreeText({ guestName, eventType, tableLabel, hostsLabel }) {
  const name = String(guestName || "אורח/ת").trim() || "אורח/ת";
  const type = String(eventType || "אירוע").trim() || "אירוע";
  const table = String(tableLabel || "?").trim() || "?";
  const hosts = String(hostsLabel || "המארחים").trim() || "המארחים";
  return [
    "✨ 🥂 ✨",
    "",
    `שלום ${name},`,
    "",
    `תודה שהגעתם ל${type}!`,
    "",
    "השולחן שלכם הוא:",
    table,
    "",
    "מחכים לחגוג איתכם,",
    hosts,
    "",
    "✨ 🥂 ✨"
  ].join("\n");
}

export function canSendTableWhatsApp(user) {
  const features = user?.deal?.includedFeatures || {};
  if (features.canSendTableWhatsApp === true) return true;
  if (features.eventDayTableNumber === true) return true;
  return false;
}

/**
 * Send one table-number WhatsApp to a seated guest.
 * Prefer passing `table` so name + number are formatted for {{3}}.
 */
export async function sendTableNumberWhatsApp({ user, guest, tableLabel, table }) {
  if (!isTwilioConfigured()) {
    return { ok: false, reason: "twilio_not_configured", message: "שירות שליחת הודעות לא מוגדר בשרת" };
  }

  const to = toTwilioWhatsAppAddress(guest?.phone);
  if (!to) {
    return { ok: false, reason: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const event = user?.event || {};
  const guestName = String(guest.fullName || "").trim() || "אורח/ת";
  const eventType = String(event.eventType || "אירוע").trim() || "אירוע";
  const hostsLabel = buildEventHostsLabel(event);
  const label = table
    ? formatTableWhatsAppLine(table, tableLabel)
    : String(tableLabel || "?").trim() || "?";

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
    return { ok: true, tableLabel: label };
  } catch (error) {
    return {
      ok: false,
      reason: "send_failed",
      message: error?.message || "שליחת ההודעה נכשלה",
      error
    };
  }
}
