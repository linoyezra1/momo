import { isCoupleEventType, isConferenceEventType } from "./eventTypeWording.js";
import { normalizeCoverFields } from "./eventCover.js";

export function normalizeEventPayload(rawEvent) {
  const eventType = String(rawEvent?.eventType || "").trim() || "חתונה";
  const groomName = String(rawEvent?.groomName || "").trim();
  const brideName = String(rawEvent?.brideName || "").trim();
  const batMitzvahName = String(rawEvent?.batMitzvahName || "").trim();
  const parentName1 = String(rawEvent?.parentName1 || "").trim();
  const parentName2 = String(rawEvent?.parentName2 || "").trim();
  const organizerName = String(rawEvent?.organizerName || "").trim();
  const conferenceBrandName = String(rawEvent?.conferenceBrandName || "").trim();
  const socialHandle = String(rawEvent?.socialHandle || "").trim();
  const locationAddress = String(rawEvent?.locationAddress || "").trim();
  const parkingDetails = String(rawEvent?.parkingDetails || "").trim();
  const websiteUrl = String(rawEvent?.websiteUrl || "").trim();
  const requestedMaxPhoneRounds = Number(rawEvent?.maxPhoneRounds);
  const maxPhoneRounds =
    Number.isInteger(requestedMaxPhoneRounds) &&
    requestedMaxPhoneRounds >= 0 &&
    requestedMaxPhoneRounds <= 4
      ? requestedMaxPhoneRounds
      : 0;

  const baseEvent = {
    eventType,
    venueName: String(rawEvent?.venueName || "").trim(),
    city: String(rawEvent?.city || "").trim(),
    streetAndNumber: String(rawEvent?.streetAndNumber || "").trim(),
    eventDate: String(rawEvent?.eventDate || "").trim(),
    eventDateHebrew: eventType === "ברית" ? String(rawEvent?.eventDateHebrew || "").trim() : "",
    eventTime: String(rawEvent?.eventTime || "").trim(),
    maxPhoneRounds,
    isPremiumWhatsappButtonsEnabled: rawEvent?.isPremiumWhatsappButtonsEnabled === true,
    transportationEnabled: rawEvent?.transportationEnabled === true,
    transportationWhatsAppLink:
      rawEvent?.transportationEnabled === true
        ? String(rawEvent?.transportationWhatsAppLink || "").trim()
        : "",
    foodSensitivitiesEnabled: rawEvent?.foodSensitivitiesEnabled === true,
    imageDataUrl: String(rawEvent?.imageDataUrl || "").trim(),
    cover: normalizeCoverFields(rawEvent?.cover),
    clearCover: rawEvent?.clearCover === true,
    groomName,
    brideName,
    batMitzvahName,
    parentName1,
    parentName2,
    organizerName: "",
    conferenceBrandName: "",
    socialHandle: "",
    locationAddress: "",
    parkingDetails: "",
    websiteUrl: ""
  };

  if (isConferenceEventType(eventType)) {
    const address =
      locationAddress ||
      [baseEvent.streetAndNumber, baseEvent.city].filter(Boolean).join(", ");
    return {
      ...baseEvent,
      organizerName,
      conferenceBrandName,
      socialHandle,
      locationAddress: address,
      parkingDetails,
      websiteUrl,
      streetAndNumber: baseEvent.streetAndNumber || address,
      city: baseEvent.city || (address ? "—" : ""),
      venueName: baseEvent.venueName || conferenceBrandName,
      eventNames: conferenceBrandName || String(rawEvent?.eventNames || "").trim()
    };
  }

  if (isCoupleEventType(eventType)) {
    return { ...baseEvent, eventNames: `${groomName} & ${brideName}`.trim() };
  }
  if (eventType === "ברית") {
    return { ...baseEvent, eventNames: `${parentName1} ו${parentName2}`.trim() };
  }
  if (eventType === "בר מצווה" || eventType === "בת מצווה") {
    return { ...baseEvent, eventNames: batMitzvahName };
  }
  return { ...baseEvent, eventNames: String(rawEvent?.eventNames || "").trim() };
}

export function validateEvent(normalizedEvent) {
  if (isCoupleEventType(normalizedEvent.eventType)) {
    if (!normalizedEvent.groomName || !normalizedEvent.brideName) {
      return "יש למלא שם חתן ושם כלה";
    }
  }
  if (isConferenceEventType(normalizedEvent.eventType)) {
    if (!normalizedEvent.organizerName || !normalizedEvent.conferenceBrandName) {
      return "יש למלא שם מארגן הכנס ושם הבמה / המותג";
    }
  }
  return "";
}

export function normalizePaymentPayload(rawPayment) {
  const amountRaw = rawPayment?.amountPaid ?? rawPayment?.paymentAmount;
  let amountPaid = 0;
  if (amountRaw !== "" && amountRaw != null && !Number.isNaN(Number(amountRaw))) {
    amountPaid = Math.max(0, Number(amountRaw));
  }
  const paymentMethod =
    rawPayment?.paymentMethod == null ? "" : String(rawPayment.paymentMethod).trim();
  return { amountPaid, paymentMethod };
}
