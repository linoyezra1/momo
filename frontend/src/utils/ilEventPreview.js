const EVENT_TYPES = ["חתונה", "ברית", "בת מצווה", "אחר"];

export const DEFAULT_WELCOME_TEXT =
  "שמחים ונרגשים להזמינכם לחגוג עמנו את היום המרגש בחיינו";

function cleanText(value) {
  return String(value ?? "").trim();
}

export function eventInfoToForm(event) {
  const source = event || {};
  return {
    eventType: EVENT_TYPES.includes(source.eventType) ? source.eventType : "חתונה",
    groomName: source.groomName || "",
    brideName: source.brideName || "",
    batMitzvahName: source.batMitzvahName || "",
    parentName1: source.parentName1 || "",
    parentName2: source.parentName2 || "",
    eventNames: source.eventNames || "",
    venueName: source.venueName || "",
    city: source.city || "",
    streetAndNumber: source.streetAndNumber || "",
    eventDate: source.eventDate || "",
    eventDateHebrew: source.eventDateHebrew || "",
    eventTime: source.eventTime || "",
    receptionTime: source.receptionTime || "",
    welcomeText: source.welcomeText || DEFAULT_WELCOME_TEXT,
    imageDataUrl: source.imageDataUrl || ""
  };
}

export function formToEventUpdatePayload(form) {
  return {
    eventType: form.eventType,
    groomName: form.groomName,
    brideName: form.brideName,
    batMitzvahName: form.batMitzvahName,
    parentName1: form.parentName1,
    parentName2: form.parentName2,
    eventNames: form.eventNames,
    venueName: form.venueName,
    city: form.city,
    streetAndNumber: form.streetAndNumber,
    eventDate: form.eventDate,
    eventDateHebrew: form.eventDateHebrew,
    eventTime: form.eventTime,
    receptionTime: form.receptionTime,
    welcomeText: form.welcomeText,
    imageDataUrl: form.imageDataUrl
  };
}

export function eventFormToPreviewPayload(form) {
  return {
    eventType: cleanText(form.eventType) || "חתונה",
    groomName: cleanText(form.groomName),
    brideName: cleanText(form.brideName),
    batMitzvahName: cleanText(form.batMitzvahName),
    parentName1: cleanText(form.parentName1),
    parentName2: cleanText(form.parentName2),
    eventNames: cleanText(form.eventNames),
    venueName: cleanText(form.venueName),
    city: cleanText(form.city),
    streetAndNumber: cleanText(form.streetAndNumber),
    eventDate: cleanText(form.eventDate),
    eventDateHebrew: cleanText(form.eventDateHebrew),
    eventTime: cleanText(form.eventTime),
    receptionTime: cleanText(form.receptionTime),
    welcomeText: cleanText(form.welcomeText) || DEFAULT_WELCOME_TEXT,
    imageDataUrl: cleanText(form.imageDataUrl)
  };
}
