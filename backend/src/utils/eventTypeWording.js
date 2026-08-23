/** Shared IL event-type vocabulary and grammar helpers (mirrors frontend). */

export const EVENT_TYPES = ["חתונה", "חינה", "אירוסין", "ברית", "בר מצווה", "בת מצווה", "כנס", "אחר"];

const COUPLE_EVENT_TYPES = new Set(["חתונה", "חינה", "אירוסין"]);

export function normalizeEventType(eventType) {
  const type = String(eventType || "").trim();
  if (type === "wedding") return "חתונה";
  if (type === "bar_mitzvah") return "בר מצווה";
  if (type === "bat_mitzvah") return "בת מצווה";
  if (type === "conference") return "כנס";
  return EVENT_TYPES.includes(type) ? type : "חתונה";
}

/** Couple celebrations that use groomName + brideName. */
export function isCoupleEventType(eventType) {
  return COUPLE_EVENT_TYPES.has(normalizeEventType(eventType));
}

/** Professional conference events. */
export function isConferenceEventType(eventType) {
  return normalizeEventType(eventType) === "כנס";
}

/** Bare noun: חתונה | חינה | … | כנס | אירוע */
export function getEventTypeNoun(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "אחר") return "אירוע";
  return type;
}

/** Definite form: החתונה | … | הכנס | האירוע */
export function getEventTypeDefinite(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "חתונה") return "החתונה";
  if (type === "חינה") return "החינה";
  if (type === "אירוסין") return "האירוסין";
  if (type === "ברית") return "הברית";
  if (type === "בר מצווה") return "בר המצווה";
  if (type === "בת מצווה") return "בת המצווה";
  if (type === "כנס") return "הכנס";
  return "האירוע";
}

/** e.g. הזמנה לחתונה / הזמנה לכנס */
export function getInviteToPhrase(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "אחר") return "הזמנה לאירוע";
  if (type === "בר מצווה") return "הזמנה לבר מצווה";
  if (type === "בת מצווה") return "הזמנה לבת מצווה";
  if (type === "כנס") return "הזמנה לכנס";
  return `הזמנה ל${type}`;
}

/** Countdown title: עד החתונה / עד הכנס / … */
export function getCountdownTitle(eventType) {
  return `עד ${getEventTypeDefinite(eventType)}`;
}

/** Plural noun for guest list UI: מוזמנים | משתתפים */
export function getGuestsListLabel(eventType) {
  return isConferenceEventType(eventType) ? "משתתפים" : "מוזמנים";
}

/** Default WhatsApp / invite welcome opener. */
export function getDefaultWelcomeParagraph(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "ברית") {
    return "משפחה וחברים יקרים, שמחים להזמינכם לחגוג עמנו את ברית המילה של בננו!";
  }
  if (type === "בר מצווה") {
    return "משפחה וחברים יקרים, אנו נרגשים להזמינכם לחגיגת בר המצווה!";
  }
  if (type === "בת מצווה") {
    return "משפחה וחברים יקרים, אנו נרגשים להזמינכם לחגיגת בת המצווה!";
  }
  if (type === "כנס") {
    return "שלום רב, הנכם מוזמנים להשתתף בכנס שלנו.";
  }
  if (type === "אחר") {
    return "משפחה וחברים יקרים, הנכם מוזמנים לאירוע שלנו!";
  }
  return `משפחה וחברים יקרים, הנכם מוזמנים ל${type} שלנו!`;
}

/** Default digital-invite opening line (above event names). */
export function getDefaultInviteWelcomeText(eventType) {
  const type = normalizeEventType(eventType);
  if (type === "חינה" || type === "אירוסין") {
    return `אנו שמחים להזמינכם לחגוג עמנו את טקס ה${type} של`;
  }
  if (type === "בר מצווה") {
    return "שמחים ונרגשים להזמינכם לחגוג עימנו את שמחת בר המצווה של בננו היקר";
  }
  if (type === "בת מצווה") {
    return "נרגשים להזמינכם לחגיגת בת המצווה של ביתנו היקרה";
  }
  if (type === "כנס") {
    return "שמחים להזמינכם להשתתף ב";
  }
  return "שמחים ונרגשים להזמינכם לחגוג עמנו את היום המרגש בחיינו";
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
 */
export function resolveEventKind(event) {
  const type = normalizeEventType(event?.eventType);
  if (isCoupleEventType(type)) return "couple";
  if (type === "ברית") return "brit";
  if (type === "בר מצווה") return "bar_mitzvah";
  if (type === "בת מצווה") return "bat_mitzvah";
  if (type === "כנס") return "conference";
  if (event?.groomName && event?.brideName) return "couple";
  if (event?.parentName1 && event?.parentName2) return "brit";
  return "other";
}
