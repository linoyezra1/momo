import { getDefaultWelcomeParagraph } from "./eventTypeWording.js";
import { formatIsraeliDate } from "../utils/whatsappMessage.js";

/**
 * Free-text for WhatsApp template {{3}} (after locked "האירוע יתקיים ב").
 * Example: 18.06.2026 באולם עדיה בכתובת הרצל 1, תל אביב בשעה 20:30
 */
export function buildDefaultEventDetailsParagraph(event = {}) {
  const date = formatIsraeliDate(event?.eventDate);
  const venue = String(event?.venueName || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const eventTime = String(event?.eventTime || "").trim();
  const receptionTime = String(event?.receptionTime || "").trim();
  const address = [street, city].filter(Boolean).join(", ");

  const parts = [];
  if (date) parts.push(date);
  if (venue) parts.push(`באולם ${venue}`);
  if (address) parts.push(`בכתובת ${address}`);
  if (receptionTime && eventTime) {
    parts.push(`קבלת פנים בשעה ${receptionTime} וטקס בשעה ${eventTime}`);
  } else if (receptionTime) {
    parts.push(`בשעה ${receptionTime}`);
  } else if (eventTime) {
    parts.push(`בשעה ${eventTime}`);
  }

  return parts.length ? parts.join(" ") : "פרטי האירוע יתעדכנו בקרוב";
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
  const eventDetailsParagraph =
    String(event?.eventDetailsParagraph || "").trim() || buildDefaultEventDetailsParagraph(event);
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
