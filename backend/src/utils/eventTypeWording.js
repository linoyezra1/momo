/** Shared IL event-type vocabulary and grammar helpers (mirrors frontend). */

export const EVENT_TYPES = ["חתונה", "חינה", "אירוסין", "ברית", "בת מצווה", "אחר"];

const COUPLE_EVENT_TYPES = new Set(["חתונה", "חינה", "אירוסין"]);

export function normalizeEventType(eventType) {
  const type = String(eventType || "").trim();
  return EVENT_TYPES.includes(type) ? type : "חתונה";
}

/** Couple celebrations that use groomName + brideName. */
export function isCoupleEventType(eventType) {
  return COUPLE_EVENT_TYPES.has(String(eventType || "").trim());
}

/** Bare noun: חתונה | חינה | אירוסין | ברית | בת מצווה | אירוע */
export function getEventTypeNoun(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "אחר") return "אירוע";
  return type;
}

/** Definite form: החתונה | החינה | האירוסין | הברית | בת המצווה | האירוע */
export function getEventTypeDefinite(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "חתונה") return "החתונה";
  if (type === "חינה") return "החינה";
  if (type === "אירוסין") return "האירוסין";
  if (type === "ברית") return "הברית";
  if (type === "בת מצווה") return "בת המצווה";
  return "האירוע";
}

/** e.g. הזמנה לחתונה / הזמנה לחינה / הזמנה לאירוסין */
export function getInviteToPhrase(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "אחר") return "הזמנה לאירוע";
  if (type === "בת מצווה") return "הזמנה לבת מצווה";
  return `הזמנה ל${type}`;
}

/** Countdown title: עד החתונה / עד החינה / … */
export function getCountdownTitle(eventType) {
  return `עד ${getEventTypeDefinite(eventType)}`;
}

/** Default WhatsApp / invite welcome opener. */
export function getDefaultWelcomeParagraph(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "ברית") {
    return "משפחה וחברים יקרים, שמחים להזמינכם לחגוג עמנו את ברית המילה של בננו!";
  }
  if (type === "בת מצווה") {
    return "משפחה וחברים יקרים, אנו נרגשים להזמינכם לחגיגת בת המצווה!";
  }
  if (type === "אחר") {
    return "משפחה וחברים יקרים, הנכם מוזמנים לאירוע שלנו!";
  }
  return `משפחה וחברים יקרים, הנכם מוזמנים ל${type} שלנו!`;
}

/** Timeline ceremony label for couple events. */
export function getCeremonyLabel(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "חתונה") return "חופה וקידושין";
  if (type === "חינה") return "טקס החינה";
  if (type === "אירוסין") return "טקס האירוסין";
  return "טקס";
}

/**
 * Coarse kind for WhatsApp message builders.
 * Couple types (חתונה/חינה/אירוסין) share the couple template with type-specific wording.
 */
export function resolveEventKind(event) {
  const type = String(event?.eventType || "").trim();
  if (isCoupleEventType(type)) return "couple";
  if (type === "ברית") return "brit";
  if (type === "בת מצווה") return "bat_mitzvah";
  if (event?.groomName && event?.brideName) return "couple";
  if (event?.parentName1 && event?.parentName2) return "brit";
  return "other";
}
