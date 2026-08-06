import { formatIsraeliDate, formatIsraeliWeekday } from "./dateFormat.js";
import { getEventTypeNoun, resolveEventKind } from "./eventTypeWording.js";
import { normalizeIsraeliPhone } from "./phoneNormalize.js";
import { resolveInviteCopyDefaults } from "./whatsappInviteCopy.js";

const RSVP_PROMPT = "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:";

export function toInternationalWhatsAppPhone(phone) {
  const domestic = normalizeIsraeliPhone(phone);
  if (!domestic) return "";
  if (domestic.startsWith("0")) {
    return `972${domestic.slice(1)}`;
  }
  return domestic;
}

function buildPublicEventLink({ eventId, origin }) {
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${String(baseOrigin).replace(/\/$/, "")}/event/${eventId}`;
}

export function buildWhatsAppTemplateDefaults({ event, eventId, origin }) {
  const publicLink = buildPublicEventLink({ eventId, origin });
  const weekday = formatIsraeliWeekday(event?.eventDate);
  const date = formatIsraeliDate(event?.eventDate);
  const venue = event?.venueName || "";
  const city = event?.city || "";
  const street = event?.streetAndNumber || "";
  const venueLine = [venue, city, street].filter(Boolean).join(", ");
  const dateLine = [weekday, date].filter(Boolean).join(" ");
  const kind = resolveEventKind(event);
  const eventNoun = getEventTypeNoun(event?.eventType);

  if (kind === "couple") {
    const groom = event?.groomName || "";
    const bride = event?.brideName || "";
    return {
      intro: `משפחה וחברים יקרים,\nהנכם מוזמנים ל${eventNoun} שלנו! 💍`,
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

export function buildGuestWhatsAppMessage({ event, eventId, origin, guestName }) {
  const { rsvpLink } = buildWhatsAppTemplateDefaults({
    event,
    eventId,
    origin
  });
  const { welcomeParagraph, eventDetailsParagraph, closingParagraph } =
    resolveInviteCopyDefaults(event);
  const name = String(guestName || "").trim() || "אורח/ת יקר/ה";

  return [
    "✨ 🥂 ✨",
    `שלום ${name},`,
    "",
    welcomeParagraph,
    "",
    `האירוע יתקיים ב${eventDetailsParagraph}`,
    "",
    RSVP_PROMPT,
    rsvpLink,
    "",
    closingParagraph,
    "✨ 🎉 ✨"
  ].join("\n");
}

export function buildWhatsAppMessageTemplate({ event, eventId, origin }) {
  const { rsvpLink } = buildWhatsAppTemplateDefaults({
    event,
    eventId,
    origin
  });
  const { welcomeParagraph, eventDetailsParagraph, closingParagraph } =
    resolveInviteCopyDefaults(event);

  return [
    "✨ 🥂 ✨",
    "שלום [שם האורח],",
    "",
    welcomeParagraph,
    "",
    `האירוע יתקיים ב${eventDetailsParagraph}`,
    "",
    RSVP_PROMPT,
    rsvpLink,
    "",
    closingParagraph,
    "✨ 🎉 ✨"
  ].join("\n");
}

export function personalizeWhatsAppMessage(template, guestName) {
  const name = String(guestName || "").trim();
  if (!template) return template;
  if (template.includes("[שם האורח]")) {
    return String(template).replace(/\[שם האורח\]/g, name || "אורח/ת יקר/ה");
  }
  if (template.includes("[שם]")) {
    return String(template).replace(/\[שם\]/g, name || "אורח/ת יקר/ה");
  }
  return name ? `שלום ${name},\n\n${template}` : template;
}

export function buildWhatsAppSendUrl({ phone, event, eventId, origin, guestName }) {
  const intlPhone = toInternationalWhatsAppPhone(phone);
  if (!intlPhone) return "";
  const message = buildGuestWhatsAppMessage({ event, eventId, origin, guestName });
  const encoded = encodeURIComponent(message);
  if (typeof window !== "undefined") {
    const ua = String(window.navigator?.userAgent || "").toLowerCase();
    const isMobile = /android|iphone|ipad|ipod/.test(ua);
    if (isMobile) {
      return `whatsapp://send?phone=${intlPhone}&text=${encoded}`;
    }
  }
  return `https://wa.me/${intlPhone}?text=${encoded}`;
}
