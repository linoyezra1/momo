import { EVENT_TYPES, isCoupleEventType, isConferenceEventType } from "./eventTypeWording.js";
import { normalizeCoverFields } from "./eventCover.js";

function cleanText(value) {
  return String(value ?? "").trim();
}

export function normalizeIlEventUpdatePayload(body) {
  const eventType = cleanText(body?.eventType);
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error("סוג אירוע לא תקין");
  }

  const eventDate = cleanText(body?.eventDate);
  const eventTime = cleanText(body?.eventTime);

  const payload = {
    eventType,
    groomName: "",
    brideName: "",
    batMitzvahName: "",
    parentName1: "",
    parentName2: "",
    eventNames: "",
    organizerName: "",
    conferenceBrandName: "",
    socialHandle: "",
    locationAddress: "",
    parkingDetails: "",
    websiteUrl: "",
    venueName: cleanText(body?.venueName),
    city: cleanText(body?.city),
    streetAndNumber: cleanText(body?.streetAndNumber),
    eventDate,
    eventDateHebrew: "",
    eventTime,
    receptionTime: cleanText(body?.receptionTime),
    welcomeText: cleanText(body?.welcomeText),
    imageDataUrl: cleanText(body?.imageDataUrl),
    cover: normalizeCoverFields(body?.cover),
    clearCover: body?.clearCover === true
  };

  if (isConferenceEventType(eventType)) {
    payload.organizerName = cleanText(body?.organizerName);
    payload.conferenceBrandName = cleanText(body?.conferenceBrandName);
    payload.socialHandle = cleanText(body?.socialHandle);
    payload.locationAddress = cleanText(body?.locationAddress);
    payload.parkingDetails = cleanText(body?.parkingDetails);
    payload.websiteUrl = cleanText(body?.websiteUrl);
    payload.eventNames = payload.conferenceBrandName;
    if (!payload.locationAddress && payload.streetAndNumber) {
      payload.locationAddress = [payload.streetAndNumber, payload.city].filter(Boolean).join(", ");
    }
    if (!payload.streetAndNumber && payload.locationAddress) {
      payload.streetAndNumber = payload.locationAddress;
    }
    if (!payload.city && payload.locationAddress) {
      payload.city = "—";
    }
    if (!payload.venueName && payload.conferenceBrandName) {
      payload.venueName = payload.conferenceBrandName;
    }
    if (!payload.organizerName || !payload.conferenceBrandName) {
      throw new Error("יש למלא שם מארגן הכנס ושם הבמה / המותג");
    }
    if (!payload.locationAddress || !eventDate || !eventTime) {
      throw new Error("יש למלא כתובת, תאריך ושעת התכנסות");
    }
    return payload;
  }

  if (!payload.venueName || !payload.city || !payload.streetAndNumber || !eventDate || !eventTime) {
    throw new Error("יש למלא מתחם, עיר, כתובת, תאריך ושעה");
  }

  if (isCoupleEventType(eventType)) {
    payload.groomName = cleanText(body?.groomName);
    payload.brideName = cleanText(body?.brideName);
    if (!payload.groomName || !payload.brideName) {
      throw new Error("יש למלא שם חתן ושם כלה");
    }
    payload.eventNames = `${payload.groomName} & ${payload.brideName}`;
  } else if (eventType === "ברית") {
    payload.parentName1 = cleanText(body?.parentName1);
    payload.parentName2 = cleanText(body?.parentName2);
    payload.eventDateHebrew = cleanText(body?.eventDateHebrew);
    if (!payload.parentName1 || !payload.parentName2) {
      throw new Error("יש למלא שמות הורים");
    }
    payload.eventNames = `${payload.parentName1} ו${payload.parentName2}`;
  } else if (eventType === "בר מצווה" || eventType === "בת מצווה") {
    payload.batMitzvahName = cleanText(body?.batMitzvahName);
    payload.parentName1 = cleanText(body?.parentName1);
    payload.parentName2 = cleanText(body?.parentName2);
    if (!payload.batMitzvahName || !payload.parentName1) {
      throw new Error("יש למלא שם החוגג/ת ושם הורה");
    }
    payload.eventNames = payload.batMitzvahName;
  } else {
    payload.eventNames = cleanText(body?.eventNames);
    if (!payload.eventNames) {
      throw new Error("יש למלא שמות לאירוע");
    }
  }

  return payload;
}
