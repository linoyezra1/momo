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

function resolveEventKind(event) {
  const type = String(event?.eventType || "").trim();
  if (type === "חתונה") return "wedding";
  if (type === "ברית") return "brit";
  if (event?.groomName && event?.brideName) return "wedding";
  if (event?.parentName1 && event?.parentName2) return "brit";
  return "other";
}

export function buildGuestWhatsAppMessage({ event, eventId, origin }) {
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const publicLink = `${baseOrigin}/event/${eventId}`;
  const weekday = formatIsraeliWeekday(event?.eventDate);
  const date = formatIsraeliDate(event?.eventDate);
  const venue = event?.venueName || "";
  const city = event?.city || "";
  const street = event?.streetAndNumber || "";
  const venueLine = [venue, city, street].filter(Boolean).join(", ");
  const dateLine = [weekday, date].filter(Boolean).join(" ");
  const kind = resolveEventKind(event);

  if (kind === "wedding") {
    const groom = event?.groomName || "";
    const bride = event?.brideName || "";
    return `משפחה וחברים יקרים,
הנכם מוזמנים לחתונה שלנו! 💍

האירוע יתקיים ב${dateLine}
ב${venueLine} 🥂

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${groom} ו${bride}`;
  }

  if (kind === "brit") {
    const parent1 = event?.parentName1 || "";
    const parent2 = event?.parentName2 || "";
    return `משפחה וחברים יקרים,
הנכם מוזמנים לחגוג עימנו את ברית המילה של בננו! 👶

האירוע יתקיים ב${dateLine}
ב${venueLine} 🎉

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${parent1} ו${parent2}`;
  }

  const owners = event?.eventNames || "";
  return `משפחה וחברים יקרים,
הנכם מוזמנים לאירוע שלנו!

האירוע יתקיים ב${dateLine}
ב${venueLine}

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${owners}`;
}

export function buildWhatsAppSendUrl({ phone, event, eventId, origin }) {
  const intlPhone = toInternationalWhatsAppPhone(phone);
  if (!intlPhone) return "";
  const message = buildGuestWhatsAppMessage({ event, eventId, origin });
  return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(message)}`;
}
