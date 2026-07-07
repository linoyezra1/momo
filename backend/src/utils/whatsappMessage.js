import { normalizePhone } from "./guestPhone.js";

const RSVP_PROMPT = "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:";

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

export function buildPublicEventLink({ eventId, origin }) {
  const baseOrigin = String(origin || process.env.CLIENT_URL || "").replace(/\/$/, "");
  return `${baseOrigin}/event/${eventId}`;
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

export function buildWhatsAppEditableTemplate({ event, eventId, origin }) {
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

function isLinkLine(line, rsvpLink) {
  const value = String(line || "").trim();
  if (!value) return false;
  if (value === rsvpLink) return true;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.includes("/event/")) return true;
  if (value === "[קישור]") return true;
  return false;
}

export function parseWhatsAppTemplateMessage({ message, guestName, rsvpLink, defaults }) {
  const fallback = defaults || {
    intro: "",
    eventDetails: "",
    rsvpLink,
    signature: ""
  };

  let text = String(message || "")
    .replace(/\r\n/g, "\n")
    .trim();

  text = text.replace(/^\s*שלום\s+(\[שם\]|[^\n,]+)\s*,?\s*\n?/u, "").trim();

  const eventMarker = "האירוע יתקיים ב";
  const eventIndex = text.indexOf(eventMarker);

  let intro = fallback.intro;
  let eventDetails = fallback.eventDetails;
  let link = fallback.rsvpLink || rsvpLink;
  let signature = fallback.signature;

  if (eventIndex >= 0) {
    intro = text.slice(0, eventIndex).trim() || fallback.intro;
    text = text.slice(eventIndex + eventMarker.length).trim();
  } else {
    intro = text || fallback.intro;
    text = "";
  }

  const rsvpIndex = text.indexOf(RSVP_PROMPT);
  if (rsvpIndex >= 0) {
    eventDetails = text.slice(0, rsvpIndex).trim() || fallback.eventDetails;
    text = text.slice(rsvpIndex + RSVP_PROMPT.length).trim();
  } else if (text) {
    const lines = text.split("\n").map((line) => line.trim());
    const linkLineIndex = lines.findIndex((line) => isLinkLine(line, rsvpLink));
    if (linkLineIndex >= 0) {
      eventDetails = lines.slice(0, linkLineIndex).join("\n").trim() || fallback.eventDetails;
      text = lines.slice(linkLineIndex).join("\n");
    } else {
      eventDetails = text.trim() || fallback.eventDetails;
      text = "";
    }
  }

  if (text) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const linkLineIndex = lines.findIndex((line) => isLinkLine(line, rsvpLink));
    if (linkLineIndex >= 0) {
      link = lines[linkLineIndex] === "[קישור]" ? rsvpLink : lines[linkLineIndex];
      signature = lines.slice(linkLineIndex + 1).join("\n").trim();
    } else if (lines.length) {
      signature = lines.join("\n").trim();
    }
  }

  intro = personalizeWhatsAppMessage(intro, guestName).trim();
  signature = personalizeWhatsAppMessage(signature, guestName).trim();

  return {
    intro: intro || fallback.intro,
    eventDetails: eventDetails || fallback.eventDetails,
    rsvpLink: link || rsvpLink,
    signature: signature || ""
  };
}

/** @deprecated Use buildWhatsAppEditableTemplate for bulk/template flows */
export function buildGuestWhatsAppMessage({ event, eventId, origin, guestName = "" }) {
  const editable = buildWhatsAppEditableTemplate({ event, eventId, origin });
  if (!guestName) return editable.replace("שלום [שם],", "").trim();
  return editable.replace("[שם]", guestName);
}

export function personalizeWhatsAppMessage(template, guestName) {
  const name = String(guestName || "").trim();
  if (!template || !template.includes("[שם]")) {
    return template;
  }
  return String(template).replace(/\[שם\]/g, name);
}

export function isValidGuestPhone(phone) {
  return Boolean(normalizePhone(phone));
}
