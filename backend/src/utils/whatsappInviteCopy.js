import { getDefaultWelcomeParagraph, isCoupleEventType } from "./eventTypeWording.js";

/** Locked prompt above {{4}} when standard text template is used. */
export const RSVP_PROMPT_STANDARD = "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:";
/** Locked prompt above {{4}} when quick-reply buttons template is used. */
export const RSVP_PROMPT_BUTTONS = "קישור לצפייה בהזמנה הדיגיטלית:";

export function getRsvpLinkPrompt(buttonsEnabled = false) {
  return buttonsEnabled ? RSVP_PROMPT_BUTTONS : RSVP_PROMPT_STANDARD;
}

export function isWhatsAppButtonsMode(event = {}) {
  return (
    event?.isPremiumWhatsappButtonsEnabled === true ||
    event?.includedFeatures?.isPremiumWhatsappButtonsEnabled === true ||
    event?.deal?.includedFeatures?.isPremiumWhatsappButtonsEnabled === true
  );
}

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

function formatIsraeliWeekdayLine(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString("he-IL", { weekday: "long" });
  if (!weekday) return "";
  if (weekday.startsWith("יום ")) return weekday;
  return `יום ${weekday}`;
}

function buildEventDateLine(event = {}) {
  const weekday = formatIsraeliWeekdayLine(event?.eventDate);
  const dateDots = formatIsraeliDate(event?.eventDate);
  return [weekday, dateDots].filter(Boolean).join(" ").trim();
}

function buildVenueDetailsLine(event = {}) {
  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const address = [street, city].filter(Boolean).join(", ");
  const isCouple = isCoupleEventType(event?.eventType);

  const parts = [];
  if (venue) parts.push(`באולמי "${venue}"`);
  if (address) parts.push(`בכתובת ${address}`);
  if (isCouple) {
    const reception = receptionTime || eventTime;
    if (reception) parts.push(`קבלת הפנים בשעה ${reception}`);
  } else if (eventTime) {
    parts.push(`בשעה ${eventTime}`);
  }

  return parts.join(" ").trim();
}

/**
 * Free-text for WhatsApp template {{3}} after locked "האירוע יתקיים ב".
 * Reads as:
 *   האירוע יתקיים ב{יום} {תאריך}
 *   באולמי "…" בכתובת … קבלת הפנים בשעה … / בשעה …
 */
export function buildDefaultEventDetailsParagraph(event = {}) {
  const dateLine = buildEventDateLine(event);
  const venueLine = buildVenueDetailsLine(event);
  const lines = [dateLine, venueLine].filter(Boolean);
  return lines.length ? lines.join("\n") : "פרטי האירוע יתעדכנו בקרוב";
}

/**
 * Meta template already has "ב" before {{3}}.
 * Only strip a mistaken leading ב when {{3}} itself starts with באולמי/באולם.
 */
export function toTemplateEventDetailsVariable(details) {
  return String(details || "")
    .trim()
    .replace(/^ב(?=אולמי\b|אולם\b)/, "");
}

/** True when saved {{3}} is empty/outdated and should be rebuilt from event fields. */
export function isStoredEventDetailsStale(storedDetails, event = {}) {
  const stored = String(storedDetails || "").trim();
  if (!stored) return true;

  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const isCouple = isCoupleEventType(event?.eventType);
  const time = isCouple ? receptionTime || eventTime : eventTime;
  const dateDots = formatIsraeliDate(event?.eventDate);
  const hasEventDate = Boolean(String(event?.eventDate || "").trim() && dateDots);

  if (
    venue &&
    (stored === venue ||
      stored === `באולם ${venue}` ||
      stored === `באולמי ${venue}` ||
      stored === `באולמי "${venue}"` ||
      stored === `אולמי ${venue}` ||
      stored === `אולמי "${venue}"` ||
      stored.startsWith(`${venue},`))
  ) {
    return true;
  }

  if (hasEventDate && (/^אולמי\b/.test(stored) || /^באולמי\b/.test(stored) || /^באולם\b/.test(stored))) {
    return true;
  }
  if (/\bבאולם\b/.test(stored) && !/\bאולמי\b/.test(stored) && !/\bבאולמי\b/.test(stored)) {
    return true;
  }

  if (hasEventDate && !stored.includes(dateDots)) return true;

  if ((street || city) && !stored.includes("בכתובת")) {
    const hasStreet = street && stored.includes(street);
    const hasCity = city && stored.includes(city);
    if (!hasStreet && !hasCity) return true;
  }

  if (time) {
    if (isCouple) {
      const hasReceptionWording =
        stored.includes("קבלת הפנים בשעה") || stored.includes("קבלת פנים");
      if (!hasReceptionWording && !stored.includes(time)) return true;
      if (stored.includes("קבלת פנים:") || (stored.includes("בשעה") && !stored.includes("קבלת הפנים"))) {
        return true;
      }
    } else if (!stored.includes("בשעה") && !stored.includes(time)) {
      return true;
    }
  }

  return false;
}

export function buildDefaultClosingParagraph(event = {}) {
  const bride = String(event?.brideName || "").trim();
  const groom = String(event?.groomName || "").trim();
  if (bride || groom) {
    return `אוהבים ${bride}${bride && groom ? " ו" : ""}${groom}`.trim();
  }
  const parent1 = String(event?.parentName1 || "").trim();
  const parent2 = String(event?.parentName2 || "").trim();
  if (parent1 || parent2) {
    return `אוהבים ${parent1}${parent1 && parent2 ? " ו" : ""}${parent2}`.trim();
  }
  const names = String(event?.eventNames || event?.batMitzvahName || "").trim();
  if (names) return `אוהבים ${names}`;
  return "נתראה בשמחה";
}

export function resolveWhatsAppInviteParagraphs(event = {}) {
  const welcomeParagraph =
    String(event?.welcomeParagraph || "").trim() || getDefaultWelcomeParagraph(event?.eventType);
  const storedDetails = String(event?.eventDetailsParagraph || "").trim();
  const generatedDetails = buildDefaultEventDetailsParagraph(event);
  const resolvedDetails = isStoredEventDetailsStale(storedDetails, event)
    ? generatedDetails
    : storedDetails;
  const closingParagraph =
    String(event?.closingParagraph || "").trim() || buildDefaultClosingParagraph(event);

  return {
    welcomeParagraph,
    eventDetailsParagraph: toTemplateEventDetailsVariable(resolvedDetails),
    closingParagraph
  };
}

/** @deprecated Prefer getDefaultWelcomeParagraph(eventType) */
export const DEFAULT_WELCOME_PARAGRAPH = getDefaultWelcomeParagraph("חתונה");
