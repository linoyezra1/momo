const EVENT_TYPES = ["חתונה", "ברית", "בת מצווה", "אחר"];

function cleanText(value) {
  return String(value ?? "").trim();
}

export function normalizeIlEventUpdatePayload(body) {
  const eventType = cleanText(body?.eventType);
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error("סוג אירוע לא תקין");
  }

  const venueName = cleanText(body?.venueName);
  const city = cleanText(body?.city);
  const streetAndNumber = cleanText(body?.streetAndNumber);
  const eventDate = cleanText(body?.eventDate);
  const eventTime = cleanText(body?.eventTime);

  if (!venueName || !city || !streetAndNumber || !eventDate || !eventTime) {
    throw new Error("יש למלא מתחם, עיר, כתובת, תאריך ושעה");
  }

  const payload = {
    eventType,
    groomName: "",
    brideName: "",
    batMitzvahName: "",
    parentName1: "",
    parentName2: "",
    eventNames: "",
    venueName,
    city,
    streetAndNumber,
    eventDate,
    eventDateHebrew: "",
    eventTime,
    imageDataUrl: cleanText(body?.imageDataUrl)
  };

  if (eventType === "חתונה") {
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
  } else if (eventType === "בת מצווה") {
    payload.batMitzvahName = cleanText(body?.batMitzvahName);
    payload.parentName1 = cleanText(body?.parentName1);
    payload.parentName2 = cleanText(body?.parentName2);
    if (!payload.batMitzvahName || !payload.parentName1) {
      throw new Error("יש למלא שם כלת המצווה ושם הורה");
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
