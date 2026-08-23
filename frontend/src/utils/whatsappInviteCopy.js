import { formatIsraeliDate, formatIsraeliWeekdayLine } from "./dateFormat.js";
import { getDefaultWelcomeParagraph, isCoupleEventType, isConferenceEventType } from "./eventTypeWording.js";

export const DEFAULT_WELCOME_PLACEHOLDER = "הקלידו כאן פתיחה אישית...";
export const DEFAULT_EVENT_DETAILS_PLACEHOLDER =
  'יום … תאריך\nבאולמי "…" בכתובת …';
export const DEFAULT_CLOSING_PLACEHOLDER = "הקלידו כאן סיום וחתימה...";

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

function buildEventDateLine(event = {}) {
  const weekday = formatIsraeliWeekdayLine(event?.eventDate);
  const dateDots = formatIsraeliDate(event?.eventDate);
  return [weekday, dateDots].filter(Boolean).join(" ").trim();
}

function buildVenueDetailsLine(event = {}) {
  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const locationAddress = String(event?.locationAddress || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const address = locationAddress || [street, city].filter(Boolean).join(", ");
  const isCouple = isCoupleEventType(event?.eventType);
  const isConference = isConferenceEventType(event?.eventType);

  const parts = [];
  if (isConference) {
    if (address) parts.push(`בכתובת ${address}`);
    if (eventTime) parts.push(`שעת התכנסות ${eventTime}`);
    return parts.join(" ").trim();
  }
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
 * The locked "ב" belongs to the date; the venue line keeps its own "באולמי".
 */
export function buildDefaultEventDetailsParagraph(event = {}) {
  const dateLine = buildEventDateLine(event);
  const venueLine = buildVenueDetailsLine(event);
  const lines = [dateLine, venueLine].filter(Boolean);
  return lines.length ? lines.join("\n") : "פרטי האירוע יתעדכנו בקרוב";
}

/**
 * Meta template already has "ב" before {{3}}.
 * Only strip a mistaken leading ב when {{3}} itself starts with באולמי/באולם
 * (date-first defaults must keep "באולמי" on the venue line).
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

  // Old defaults without date (venue-first) — locked ב was wrongly glued to אולמי
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
  if (isConferenceEventType(event?.eventType)) {
    const organizer = String(event?.organizerName || "").trim();
    const brand = String(event?.conferenceBrandName || event?.eventNames || "").trim();
    if (organizer) return `בברכה, ${organizer}`;
    if (brand) return `בברכה, צוות ${brand}`;
    return "נתראה בכנס";
  }
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

/** Values for the bubble editor — empty/stale {{3}} falls back to full generated defaults. */
export function resolveInviteCopyDefaults(event = {}) {
  const storedWelcome = String(event?.welcomeParagraph ?? "").trim();
  const storedDetails = String(event?.eventDetailsParagraph ?? "").trim();
  const storedClosing = String(event?.closingParagraph ?? "").trim();
  const generatedDetails = buildDefaultEventDetailsParagraph(event);

  const resolvedDetails = isStoredEventDetailsStale(storedDetails, event)
    ? generatedDetails
    : storedDetails;

  return {
    welcomeParagraph: storedWelcome || getDefaultWelcomeParagraph(event?.eventType),
    eventDetailsParagraph: toTemplateEventDetailsVariable(resolvedDetails),
    closingParagraph: storedClosing || buildDefaultClosingParagraph(event)
  };
}

/** @deprecated Prefer getDefaultWelcomeParagraph(eventType) */
export const DEFAULT_WELCOME_PARAGRAPH = getDefaultWelcomeParagraph("חתונה");
