import { toWhatsAppPhone } from "./vendors.js";

export const TABLE_DISPATCH_SALES_PHONE = "0535314055";

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

  const phone = toWhatsAppPhone(TABLE_DISPATCH_SALES_PHONE);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
