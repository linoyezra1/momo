import { getDefaultWelcomeParagraph, isCoupleEventType } from "./eventTypeWording.js";

export const DEFAULT_WELCOME_PLACEHOLDER = "הקלידו כאן פתיחה אישית...";
export const DEFAULT_EVENT_DETAILS_PLACEHOLDER = "אולמי … בכתובת …";
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
 * Free-text for WhatsApp template {{3}} after locked "האירוע יתקיים ב".
 * Template: האירוע יתקיים ב{{3}} → {{3}} must start with "אולמי" (not "באולמי").
 * Wedding: אולמי "…" בכתובת … קבלת פנים: …
 * Bar/Bat: אולמי "…" בכתובת … בשעה …
 */
export function buildDefaultEventDetailsParagraph(event = {}) {
  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const address = [street, city].filter(Boolean).join(", ");
  const isCouple = isCoupleEventType(event?.eventType);

  const parts = [];
  if (venue) parts.push(`אולמי "${venue}"`);
  if (address) parts.push(`בכתובת ${address}`);
  if (isCouple) {
    const reception = receptionTime || eventTime;
    if (reception) parts.push(`קבלת פנים: ${reception}`);
  } else if (eventTime) {
    parts.push(`בשעה ${eventTime}`);
  }

  return parts.length ? parts.join(" ") : "פרטי האירוע יתעדכנו בקרוב";
}

/**
 * Meta template already has "ב" before {{3}}. Strip a mistaken leading ב before אולם/אולמי.
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

  if (time) {
    if (isCouple) {
      if (!stored.includes("קבלת פנים") && !stored.includes(time)) return true;
      // Old wedding default used "בשעה" instead of "קבלת פנים:"
      if (stored.includes("בשעה") && !stored.includes("קבלת פנים")) return true;
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
