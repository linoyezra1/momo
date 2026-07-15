import { formatIsraeliDate } from "./dateFormat.js";

export const DEFAULT_WELCOME_PARAGRAPH =
  "אנו נרגשים מאוד להזמין אתכם לחגוג איתנו את יום נישואינו ומצפים לראותכם בין אורחינו!";

export const DEFAULT_WELCOME_PLACEHOLDER = "הקלידו כאן פתיחה אישית...";
export const DEFAULT_EVENT_DETAILS_PLACEHOLDER = "הקלידו כאן תאריך ואולם...";
export const DEFAULT_CLOSING_PLACEHOLDER = "הקלידו כאן סיום וחתימה...";

export function buildDefaultEventDetailsParagraph(event = {}) {
  const date = formatIsraeliDate(event?.eventDate);
  const venue = String(event?.venueName || "").trim();
  if (date && venue) return `${date} באולם ${venue}`;
  if (date) return String(date);
  if (venue) return `באולם ${venue}`;
  return "פרטי האירוע יתעדכנו בקרוב";
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
      welcomeParagraph: DEFAULT_WELCOME_PARAGRAPH,
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
