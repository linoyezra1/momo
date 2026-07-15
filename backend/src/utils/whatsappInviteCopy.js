import { formatIsraeliDate } from "../utils/whatsappMessage.js";

export const DEFAULT_WELCOME_PARAGRAPH =
  "אנו נרגשים מאוד להזמין אתכם לחגוג איתנו את יום נישואינו ומצפים לראותכם בין אורחינו!";

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

export function resolveWhatsAppInviteParagraphs(event = {}) {
  const welcomeParagraph =
    String(event?.welcomeParagraph || "").trim() || DEFAULT_WELCOME_PARAGRAPH;
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
