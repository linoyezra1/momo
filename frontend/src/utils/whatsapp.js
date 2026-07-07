import { formatIsraeliDate, formatIsraeliWeekday } from "./dateFormat.js";
import { normalizeIsraeliPhone } from "./phoneNormalize.js";

const RSVP_PROMPT = "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:";

export function toInternationalWhatsAppPhone(phone) {  const domestic = normalizeIsraeliPhone(phone);
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

function buildPublicEventLink({ eventId, origin }) {
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${String(baseOrigin).replace(/\/$/, "")}/event/${eventId}`;
}

function buildWhatsAppTemplateDefaults({ event, eventId, origin }) {
  const publicLink = buildPublicEventLink({ eventId, origin });
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
    return {
      intro: `משפחה וחברים יקרים,\nהנכם מוזמנים לחתונה שלנו! 💍`,
      eventDetails: [dateLine, venueLine ? `ב${venueLine} 🥂` : ""].filter(Boolean).join("\n"),
      rsvpLink: publicLink,
      signature: groom || bride ? `אוהבים,\n${groom} ו${bride}`.trim() : ""
    };
  }

  if (kind === "brit") {
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

    return {
      intro: `משפחה וחברים יקרים,\nשמחים להזמינכם לחגוג עמנו את ברית המילה של בננו שתתקיים${weekdaySuffix}! 👶`,
      eventDetails: detailLines.join("\n"),
      rsvpLink: publicLink,
      signature: parent1 || parent2 ? `אוהבים,\n${parent1} ו${parent2}`.trim() : ""
    };
  }

  if (kind === "bat_mitzvah") {
    const bat = event?.batMitzvahName || "";
    const parent1 = event?.parentName1 || "";
    const parent2 = event?.parentName2 || "";
    const address = [street, city].filter(Boolean).join(", ");
    const time = event?.eventTime ? String(event.eventTime).trim() : "";
    const loveLine = `באהבה, ${bat}, ${parent1}${parent2 ? ` ו${parent2}` : ""}`;

    return {
      intro: `משפחה וחברים יקרים,\nאנו נרגשים להזמינכם לחגיגת בת המצווה של בתנו ${bat}! 🌸`,
      eventDetails: [
        weekday && date ? `${weekday} ${date}` : dateLine,
        time ? `בשעה ${time}` : "",
        venue ? `באולמי ${venue}${address ? `, בכתובת ${address}` : ""} 🎈` : address
      ]
        .filter(Boolean)
        .join("\n"),
      rsvpLink: publicLink,
      signature: loveLine
    };
  }

  const owners = event?.eventNames || "";
  return {
    intro: "משפחה וחברים יקרים,\nהנכם מוזמנים לאירוע שלנו!",
    eventDetails: [dateLine, venueLine].filter(Boolean).join("\n"),
    rsvpLink: publicLink,
    signature: owners ? `אוהבים,\n${owners}` : ""
  };
}

export function buildGuestWhatsAppMessage({ event, eventId, origin }) {
  const { intro, eventDetails, rsvpLink, signature } = buildWhatsAppTemplateDefaults({
    event,
    eventId,
    origin
  });

  const sections = [
    intro,
    "",
    `האירוע יתקיים ב${eventDetails}`,
    "",
    RSVP_PROMPT,
    rsvpLink
  ];

  if (signature) {
    sections.push("", signature);
  }

  return sections.join("\n");
}

export function buildWhatsAppMessageTemplate({ event, eventId, origin }) {
  const { intro, eventDetails, rsvpLink, signature } = buildWhatsAppTemplateDefaults({
    event,
    eventId,
    origin
  });

  const sections = [
    "שלום [שם],",
    "",
    intro,
    "",
    `האירוע יתקיים ב${eventDetails}`,
    "",
    RSVP_PROMPT,
    rsvpLink
  ];

  if (signature) {
    sections.push("", signature);
  }

  return sections.join("\n");
}
export function personalizeWhatsAppMessage(template, guestName) {
  const name = String(guestName || "").trim();
  if (!template || !template.includes("[שם]")) {
    return name ? `שלום ${name},\n\n${template}` : template;
  }
  return String(template).replace(/\[שם\]/g, name);
}

export function buildWhatsAppSendUrl({ phone, event, eventId, origin }) {
  const intlPhone = toInternationalWhatsAppPhone(phone);
  if (!intlPhone) return "";
  const message = buildGuestWhatsAppMessage({ event, eventId, origin });
  return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(message)}`;
}
