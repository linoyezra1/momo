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
  if (type === "בת מצווה") return "bat_mitzvah";
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
    const dateDots = formatIsraeliDate(event?.eventDate);
    const street = String(event?.streetAndNumber || "").trim();
    const city = String(event?.city || "").trim();
    const time = event?.eventTime ? String(event.eventTime).trim() : "";
    const weekdaySuffix = weekday ? ` ב${weekday}` : "";
    const addressInParens = [street, city].filter(Boolean).join(", ");
    const locationLine = venue
      ? addressInParens
        ? `${venue} (${addressInParens})`
        : venue
      : addressInParens;

    const detailLines = [
      dateDots ? `🗓️ תאריך: ${dateDots}` : "",
      locationLine ? `📍 מיקום: ${locationLine}` : "",
      time ? `⏰ שעה: בשעה ${time}` : ""
    ].filter(Boolean);

    return `משפחה וחברים יקרים,
שמחים להזמינכם לחגוג עמנו את ברית המילה של בננו שתתקיים${weekdaySuffix}! 👶

${detailLines.join("\n")}

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${parent1} ו${parent2}`;
  }

  if (kind === "bat_mitzvah") {
    const bat = event?.batMitzvahName || "";
    const parent1 = event?.parentName1 || "";
    const parent2 = event?.parentName2 || "";
    const street = String(event?.streetAndNumber || "").trim();
    const city = String(event?.city || "").trim();
    const address = [street, city].filter(Boolean).join(", ");
    const time = event?.eventTime ? String(event.eventTime).trim() : "";
    const weekdaySuffix = weekday ? `${weekday}` : "";
    const loveLine = `באהבה, ${bat}, ${parent1}${parent2 ? ` ו${parent2}` : ""}`;

    return `משפחה וחברים יקרים,
אנו נרגשים להזמינכם לחגיגת בת המצווה של בתנו ${bat}! 🌸

האירוע יתקיים ב${weekdaySuffix} ${date}
בשעה ${time}
באולמי ${venue}, בכתובת ${address} 🎈

נשמח לראותכם בין אורחינו!
${loveLine}

לפרטים נוספים ואישור הגעה בקישור המצורף:
${publicLink}`;
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
