import { getDefaultWelcomeParagraph, isCoupleEventType } from "./eventTypeWording.js";

export const DEFAULT_WELCOME_PLACEHOLDER = "הקלידו כאן פתיחה אישית...";
export const DEFAULT_EVENT_DETAILS_PLACEHOLDER = "אולמי … בכתובת … בשעה …";
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

/**
 * Free-text for WhatsApp template {{3}} (after locked "האירוע יתקיים ב").
 * Must NOT start with "ב" — the template already ends with ב.
 * Reads as: האירוע יתקיים באולמי "…" בכתובת … בשעה …
 */
export function buildDefaultEventDetailsParagraph(event = {}) {
  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const address = [street, city].filter(Boolean).join(", ");
  const time = isCoupleEventType(event?.eventType)
    ? receptionTime || eventTime
    : eventTime;

  const parts = [];
  if (venue) parts.push(`אולמי "${venue}"`);
  if (address) parts.push(`בכתובת ${address}`);
  if (time) parts.push(`בשעה ${time}`);

  return parts.length ? parts.join(" ") : "פרטי האירוע יתעדכנו בקרוב";
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
  const time = isCoupleEventType(event?.eventType)
    ? receptionTime || eventTime
    : eventTime;

  if (
    venue &&
    (stored === venue ||
      stored === `באולם ${venue}` ||
      stored === `באולמי ${venue}` ||
      stored === `באולמי "${venue}"` ||
      stored === `אולמי ${venue}` ||
      stored === `אולמי "${venue}"` ||
      stored.startsWith(`${venue},`) ||
      stored.startsWith(`באולמי "`))
  ) {
    return true;
  }

  // Legacy / broken defaults (double-ב or date-prefixed)
  if (/^\d{1,2}\.\d{1,2}\.\d{4}\b/.test(stored)) return true;
  if (/^באולמי\b/.test(stored) || /^באולם\b/.test(stored)) return true;
  if (/\bבאולם\b/.test(stored) && !/\bאולמי\b/.test(stored)) return true;

  if ((street || city) && !stored.includes("בכתובת")) {
    const hasStreet = street && stored.includes(street);
    const hasCity = city && stored.includes(city);
    if (!hasStreet && !hasCity) return true;
  }

  if (time && !stored.includes("בשעה") && !stored.includes(time)) return true;

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

/** Values for the bubble editor — empty/stale {{3}} falls back to full generated defaults. */
export function resolveInviteCopyDefaults(event = {}) {
  const storedWelcome = String(event?.welcomeParagraph ?? "").trim();
  const storedDetails = String(event?.eventDetailsParagraph ?? "").trim();
  const storedClosing = String(event?.closingParagraph ?? "").trim();
  const generatedDetails = buildDefaultEventDetailsParagraph(event);

  return {
    welcomeParagraph: storedWelcome || getDefaultWelcomeParagraph(event?.eventType),
    eventDetailsParagraph: isStoredEventDetailsStale(storedDetails, event)
      ? generatedDetails
      : storedDetails,
    closingParagraph: storedClosing || buildDefaultClosingParagraph(event)
  };
}

/** @deprecated Prefer getDefaultWelcomeParagraph(eventType) */
export const DEFAULT_WELCOME_PARAGRAPH = getDefaultWelcomeParagraph("חתונה");
