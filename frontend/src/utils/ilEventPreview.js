import { EVENT_TYPES, getDefaultInviteWelcomeText, isConferenceEventType } from "./eventTypeWording.js";
import { getEventCoverSrc, resolveCoverPreview } from "./eventCover.js";

/** @deprecated Prefer getDefaultInviteWelcomeText(eventType) */
export const DEFAULT_WELCOME_TEXT = getDefaultInviteWelcomeText("חתונה");

function cleanText(value) {
  return String(value ?? "").trim();
}

export function eventInfoToForm(event) {
  const source = event || {};
  const eventType = EVENT_TYPES.includes(source.eventType) ? source.eventType : "חתונה";
  const coverSrc = getEventCoverSrc(source);
  return {
    eventType,
    groomName: source.groomName || "",
    brideName: source.brideName || "",
    batMitzvahName: source.batMitzvahName || "",
    parentName1: source.parentName1 || "",
    parentName2: source.parentName2 || "",
    eventNames: source.eventNames || "",
    organizerName: source.organizerName || "",
    conferenceBrandName: source.conferenceBrandName || source.eventNames || "",
    socialHandle: source.socialHandle || "",
    locationAddress:
      source.locationAddress ||
      [source.streetAndNumber, source.city].filter(Boolean).join(", ") ||
      "",
    parkingDetails: source.parkingDetails || "",
    websiteUrl: source.websiteUrl || "",
    venueName: source.venueName || "",
    city: source.city || "",
    streetAndNumber: source.streetAndNumber || "",
    eventDate: source.eventDate || "",
    eventDateHebrew: source.eventDateHebrew || "",
    eventTime: source.eventTime || "",
    receptionTime: source.receptionTime || "",
    welcomeText: source.welcomeText || getDefaultInviteWelcomeText(eventType),
    transportationEnabled: Boolean(source.transportationEnabled),
    transportationWhatsAppLink: source.transportationWhatsAppLink || "",
    foodSensitivitiesEnabled: Boolean(source.foodSensitivitiesEnabled),
    cover: source.cover || null,
    coverPreviewUrl: coverSrc,
    pendingCoverFile: null,
    clearCover: false,
    imageDataUrl: ""
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
    organizerName: form.organizerName,
    conferenceBrandName: form.conferenceBrandName,
    socialHandle: form.socialHandle,
    locationAddress: form.locationAddress,
    parkingDetails: form.parkingDetails,
    websiteUrl: form.websiteUrl,
    venueName: form.venueName,
    city: form.city,
    streetAndNumber: form.streetAndNumber,
    eventDate: form.eventDate,
    eventDateHebrew: form.eventDateHebrew,
    eventTime: form.eventTime,
    receptionTime: form.receptionTime,
    welcomeText: form.welcomeText,
    transportationEnabled: Boolean(form.transportationEnabled),
    transportationWhatsAppLink: form.transportationEnabled ? form.transportationWhatsAppLink : "",
    foodSensitivitiesEnabled: Boolean(form.foodSensitivitiesEnabled),
    clearCover: form.clearCover === true && !form.pendingCoverFile
  };
}

export function eventFormToPreviewPayload(form) {
  const eventType = cleanText(form.eventType) || "חתונה";
  const previewSrc = resolveCoverPreview(form);
  const conference = isConferenceEventType(eventType);
  return {
    eventType,
    groomName: cleanText(form.groomName),
    brideName: cleanText(form.brideName),
    batMitzvahName: cleanText(form.batMitzvahName),
    parentName1: cleanText(form.parentName1),
    parentName2: cleanText(form.parentName2),
    eventNames: conference ? cleanText(form.conferenceBrandName) : cleanText(form.eventNames),
    organizerName: cleanText(form.organizerName),
    conferenceBrandName: cleanText(form.conferenceBrandName),
    socialHandle: cleanText(form.socialHandle),
    locationAddress: cleanText(form.locationAddress),
    parkingDetails: cleanText(form.parkingDetails),
    websiteUrl: cleanText(form.websiteUrl),
    venueName: cleanText(form.venueName),
    city: cleanText(form.city),
    streetAndNumber: cleanText(form.streetAndNumber),
    eventDate: cleanText(form.eventDate),
    eventDateHebrew: cleanText(form.eventDateHebrew),
    eventTime: cleanText(form.eventTime),
    receptionTime: cleanText(form.receptionTime),
    welcomeText: cleanText(form.welcomeText) || getDefaultInviteWelcomeText(eventType),
    transportationEnabled: Boolean(form.transportationEnabled),
    transportationWhatsAppLink: form.transportationEnabled
      ? cleanText(form.transportationWhatsAppLink)
      : "",
    foodSensitivitiesEnabled: Boolean(form.foodSensitivitiesEnabled),
    cover: form.cover || (previewSrc ? { url: previewSrc } : null),
    imageDataUrl: previewSrc.startsWith("data:image/") || previewSrc.startsWith("blob:") ? previewSrc : ""
  };
}
