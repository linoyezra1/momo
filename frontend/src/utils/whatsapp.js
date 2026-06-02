import { formatIsraeliDate, formatIsraeliWeekday } from "./dateFormat.js";
import { normalizeIsraeliPhone } from "./phoneNormalize.js";

export function toInternationalWhatsAppPhone(phone) {
  const domestic = normalizeIsraeliPhone(phone);
  if (!domestic) return "";
  if (domestic.startsWith("0")) {
    return `972${domestic.slice(1)}`;
  }
  return domestic;
}

export function buildGuestWhatsAppMessage({ event, eventId, origin }) {
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const publicLink = `${baseOrigin}/event/${eventId}`;
  const weekday = formatIsraeliWeekday(event?.eventDate);
  const date = formatIsraeliDate(event?.eventDate);
  const venue = event?.venueName || "";
  const dateLine = [weekday, date].filter(Boolean).join(" ");

  if (event?.eventType === "חתונה") {
    const groom = event.groomName || "";
    const bride = event.brideName || "";
    return `משפחה וחברים יקרים,
הנכם מוזמנים לחתונה שלנו! 💍

האירוע יתקיים ב${dateLine}
ב${venue} 🥂

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${groom} ו${bride}`;
  }

  if (event?.eventType === "ברית") {
    const parent1 = event.parentName1 || "";
    const parent2 = event.parentName2 || "";
    return `משפחה וחברים יקרים,
הנכם מוזמנים לחגוג עימנו את ברית המילה של בננו! 👶

האירוע יתקיים ב${dateLine}
ב${venue} 🎉

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${parent1} ו${parent2}`;
  }

  const owners = event?.eventNames || "";
  return `משפחה וחברים יקרים,
הנכם מוזמנים לאירוע שלנו!

האירוע יתקיים ב${dateLine}
ב${venue}

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${owners}`;
}

export function buildWhatsAppSendUrl({ phone, fullName: _fullName, event, eventId, origin }) {
  const intlPhone = toInternationalWhatsAppPhone(phone);
  const message = buildGuestWhatsAppMessage({ event, eventId, origin });
  return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(message)}`;
}
