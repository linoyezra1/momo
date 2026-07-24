import { toWhatsAppPhone } from "./vendors.js";

/** Official momoEVENT sales / support phone (coupons + table dispatch + help). */
export const MOMOEVENT_SUPPORT_PHONE = "0585915109";

/** @deprecated use MOMOEVENT_SUPPORT_PHONE */
export const TABLE_DISPATCH_SALES_PHONE = MOMOEVENT_SUPPORT_PHONE;

export function buildSupportWhatsAppUrl(prefilledText = "") {
  const phone = toWhatsAppPhone(MOMOEVENT_SUPPORT_PHONE);
  if (!phone) return "";
  const text = String(prefilledText || "").trim();
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`;
}

function buildEventDisplayName(event = {}) {
  if (!event) return "האירוע שלי";
  if (event.eventType === "חתונה") {
    const groom = String(event.groomName || "").trim();
    const bride = String(event.brideName || "").trim();
    if (groom && bride) return `${groom} ו${bride}`;
    return groom || bride || "חתונה";
  }
  if (event.eventType === "ברית") {
    const p1 = String(event.parentName1 || "").trim();
    const p2 = String(event.parentName2 || "").trim();
    if (p1 && p2) return `${p1} ו${p2}`;
    return p1 || p2 || "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return String(event.batMitzvahName || event.parentName1 || "בת מצווה").trim() || "בת מצווה";
  }
  return String(event.eventNames || "האירוע שלי").trim() || "האירוע שלי";
}

/**
 * Pre-filled WhatsApp to sales for purchasing day-of table dispatch.
 */
export function buildTableDispatchPurchaseWhatsAppUrl({
  event,
  eventLabel,
  eventType,
  eventId
} = {}) {
  const label = eventLabel || buildEventDisplayName(event);
  const type = eventType || event?.eventType || "אירוע";
  const date = event?.eventDate ? String(event.eventDate) : "";
  const venue = [event?.venueName, event?.city].filter(Boolean).join(", ");

  const lines = [
    "שלום, מעוניינים לרכוש את שירות שליחת מספר שולחן למוזמנים (דיילות דיגיטלית / WhatsApp).",
    "",
    `שם האירוע: ${label}`,
    `סוג אירוע: ${type}`
  ];
  if (date) lines.push(`תאריך: ${date}`);
  if (venue) lines.push(`מיקום: ${venue}`);
  if (eventId) lines.push(`מזהה אירוע: ${eventId}`);
  lines.push("", "אשמח לקבל פרטים להפעלה ורכישה. תודה!");

  return buildSupportWhatsAppUrl(lines.join("\n"));
}

/**
 * Pre-filled WhatsApp for purchasing regular WhatsApp bulk-invite coupons.
 */
export function buildWhatsAppCouponPurchaseUrl({ event, eventLabel, eventId } = {}) {
  const label = eventLabel || buildEventDisplayName(event);
  const lines = [
    "שלום, מעוניינים לרכוש קופון לשליחת אישורי הגעה ב-WhatsApp (תפוצה רחבה).",
    "",
    `שם האירוע: ${label}`
  ];
  if (eventId) lines.push(`מזהה אירוע: ${eventId}`);
  lines.push("", "אשמח לקבל פרטים וקוד רכישה. תודה!");
  return buildSupportWhatsAppUrl(lines.join("\n"));
}
