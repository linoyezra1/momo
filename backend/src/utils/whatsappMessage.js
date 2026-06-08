import { normalizePhone } from "./guestPhone.js";

function parseIsoDateParts(dateStr) {
  const raw = String(dateStr ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!isoMatch) return null;
  return {
    year: Number(isoMatch[1]),
    month: Number(isoMatch[2]),
    day: Number(isoMatch[3])
  };
}

function formatIsraeliDate(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return String(dateStr ?? "").trim().replace(/-/g, ".");
  const { year, month, day } = parts;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function formatIsraeliWeekday(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("he-IL", { weekday: "long" });
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

export function buildGuestWhatsAppMessage({ event, eventId, origin, guestName = "" }) {
  const baseOrigin = origin || process.env.CLIENT_URL || "";
  const publicLink = `${baseOrigin.replace(/\/$/, "")}/event/${eventId}`;
  const weekday = formatIsraeliWeekday(event?.eventDate);
  const date = formatIsraeliDate(event?.eventDate);
  const venue = event?.venueName || "";
  const city = event?.city || "";
  const street = event?.streetAndNumber || "";
  const venueLine = [venue, city, street].filter(Boolean).join(", ");
  const dateLine = [weekday, date].filter(Boolean).join(" ");
  const kind = resolveEventKind(event);

  let body = "";

  if (kind === "wedding") {
    const groom = event?.groomName || "";
    const bride = event?.brideName || "";
    body = `משפחה וחברים יקרים,
הנכם מוזמנים לחתונה שלנו! 💍

האירוע יתקיים ב${dateLine}
ב${venueLine} 🥂

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${groom} ו${bride}`;
  } else if (kind === "brit") {
    const parent1 = event?.parentName1 || "";
    const parent2 = event?.parentName2 || "";
    const dateDots = formatIsraeliDate(event?.eventDate);
    const addressInParens = [street, city].filter(Boolean).join(", ");
    const time = event?.eventTime ? String(event.eventTime).trim() : "";
    const weekdaySuffix = weekday ? ` ב${weekday}` : "";
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

    body = `משפחה וחברים יקרים,
שמחים להזמינכם לחגוג עמנו את ברית המילה של בננו שתתקיים${weekdaySuffix}! 👶

${detailLines.join("\n")}

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${parent1} ו${parent2}`;
  } else if (kind === "bat_mitzvah") {
    const bat = event?.batMitzvahName || "";
    const parent1 = event?.parentName1 || "";
    const parent2 = event?.parentName2 || "";
    const address = [street, city].filter(Boolean).join(", ");
    const time = event?.eventTime ? String(event.eventTime).trim() : "";
    const loveLine = `באהבה, ${bat}, ${parent1}${parent2 ? ` ו${parent2}` : ""}`;

    body = `משפחה וחברים יקרים,
אנו נרגשים להזמינכם לחגיגת בת המצווה של בתנו ${bat}! 🌸

האירוע יתקיים ב${weekday} ${date}
בשעה ${time}
באולמי ${venue}, בכתובת ${address} 🎈

נשמח לראותכם בין אורחינו!
${loveLine}

לפרטים נוספים ואישור הגעה בקישור המצורף:
${publicLink}`;
  } else {
    const owners = event?.eventNames || "";
    body = `משפחה וחברים יקרים,
הנכם מוזמנים לאירוע שלנו!

האירוע יתקיים ב${dateLine}
ב${venueLine}

נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:
${publicLink}

אוהבים,
${owners}`;
  }

  if (guestName) {
    return `שלום ${guestName},\n\n${body}`;
  }
  return body;
}

export function personalizeWhatsAppMessage(template, guestName) {
  const name = String(guestName || "").trim();
  if (!template || !template.includes("[שם]")) {
    return name ? `שלום ${name},\n\n${template}` : template;
  }
  return String(template).replace(/\[שם\]/g, name);
}

export function isValidGuestPhone(phone) {
  return Boolean(normalizePhone(phone));
}
