import { formatIsraeliDate } from "./dateFormat.js";

export function toInternationalWhatsAppPhone(phone) {
  let digits = String(phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `972${digits}`;
  return digits;
}

export function buildEventOwnersText(event) {
  if (!event) return "";
  if (event.eventType === "חתונה") {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim();
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim();
  }
  return String(event.eventNames || "").trim();
}

export function buildGuestWhatsAppMessage({ fullName, event, eventId, origin }) {
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const publicLink = `${baseOrigin}/event/${eventId}`;
  const owners = buildEventOwnersText(event);
  const eventType = event?.eventType || "האירוע";
  const venue = event?.venueName || "";
  const city = event?.city || "";
  const street = event?.streetAndNumber || "";
  const date = formatIsraeliDate(event?.eventDate);
  const time = event?.eventTime || "";

  return `שלום ${fullName},
שמחים להזמינכם לחגוג עימנו את האירוע: ${eventType} של ${owners}.

📅 פרטי האירוע:
📍 מתחם/אולם: ${venue} (${city}, ${street})
🗓️ תאריך: ${date}
⏰ שעה: ${time}

נשמח אם תוכלו לאשר הגעתכם בקישור:
${publicLink}

תודה רבה,
${owners}`;
}

export function buildWhatsAppSendUrl({ phone, fullName, event, eventId, origin }) {
  const intlPhone = toInternationalWhatsAppPhone(phone);
  const message = buildGuestWhatsAppMessage({ fullName, event, eventId, origin });
  return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(message)}`;
}
