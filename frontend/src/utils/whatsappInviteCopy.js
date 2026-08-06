import { formatIsraeliDate } from "./dateFormat.js";
import { getDefaultWelcomeParagraph } from "./eventTypeWording.js";

export const DEFAULT_WELCOME_PLACEHOLDER = "הקלידו כאן פתיחה אישית...";
export const DEFAULT_EVENT_DETAILS_PLACEHOLDER = "תאריך באולם … בכתובת … בשעה …";
export const DEFAULT_CLOSING_PLACEHOLDER = "הקלידו כאן סיום וחתימה...";

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

/** Values for the bubble editor. Empty saved strings stay empty (placeholder shown). */
export function resolveInviteCopyDefaults(event = {}) {
  const storedWelcome = String(event?.welcomeParagraph ?? "");
  const storedDetails = String(event?.eventDetailsParagraph ?? "");
  const storedClosing = String(event?.closingParagraph ?? "");
  const noneSaved =
    !storedWelcome.trim() && !storedDetails.trim() && !storedClosing.trim();

  if (noneSaved) {
    return {
      welcomeParagraph: getDefaultWelcomeParagraph(event?.eventType),
      eventDetailsParagraph: buildDefaultEventDetailsParagraph(event),
      closingParagraph: buildDefaultClosingParagraph(event)
    };
  }

  return {
    welcomeParagraph: storedWelcome,
    eventDetailsParagraph: storedDetails,
    closingParagraph: storedClosing
  };
}

/** @deprecated Prefer getDefaultWelcomeParagraph(eventType) */
export const DEFAULT_WELCOME_PARAGRAPH = getDefaultWelcomeParagraph("חתונה");
