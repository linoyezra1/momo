import { getDefaultWelcomeParagraph, isCoupleEventType } from "./eventTypeWording.js";

/**
 * Free-text for WhatsApp template {{3}} (after locked "האירוע יתקיים ב").
 * Wedding: עדיה, שדרות ירושלים 36, קרית מלאכי, קבלת פנים: 19:30
 * Bar/Bat: חמ"ה, שדרות ירושלים 36, קרית מלאכי, בשעה 19:30
 */
export function buildDefaultEventDetailsParagraph(event = {}) {
  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const type = String(event?.eventType || "").trim();

  const parts = [];
  if (venue) parts.push(venue);
  if (street) parts.push(street);
  if (city) parts.push(city);

  if (isCoupleEventType(type)) {
    if (receptionTime) parts.push(`קבלת פנים: ${receptionTime}`);
  } else if (eventTime) {
    parts.push(`בשעה ${eventTime}`);
  }

  return parts.length ? parts.join(", ") : "פרטי האירוע יתעדכנו בקרוב";
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
  const venue = String(event?.venueName || "").trim();
  const generatedDetails = buildDefaultEventDetailsParagraph(event);
  const detailsAreStale =
    !storedDetails ||
    (venue && (storedDetails === venue || storedDetails === `באולם ${venue}`));
  const eventDetailsParagraph = detailsAreStale ? generatedDetails : storedDetails;
  const closingParagraph =
    String(event?.closingParagraph || "").trim() || buildDefaultClosingParagraph(event);

  return {
    welcomeParagraph,
    eventDetailsParagraph,
    closingParagraph
  };
}

/** @deprecated Prefer getDefaultWelcomeParagraph(eventType) */
export const DEFAULT_WELCOME_PARAGRAPH = getDefaultWelcomeParagraph("חתונה");
