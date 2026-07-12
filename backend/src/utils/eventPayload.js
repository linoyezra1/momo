export function normalizeEventPayload(rawEvent) {
  const eventType = String(rawEvent?.eventType || "").trim() || "חתונה";
  const groomName = String(rawEvent?.groomName || "").trim();
  const brideName = String(rawEvent?.brideName || "").trim();
  const batMitzvahName = String(rawEvent?.batMitzvahName || "").trim();
  const parentName1 = String(rawEvent?.parentName1 || "").trim();
  const parentName2 = String(rawEvent?.parentName2 || "").trim();

  const baseEvent = {
    eventType,
    venueName: String(rawEvent?.venueName || "").trim(),
    city: String(rawEvent?.city || "").trim(),
    streetAndNumber: String(rawEvent?.streetAndNumber || "").trim(),
    eventDate: String(rawEvent?.eventDate || "").trim(),
    eventDateHebrew: eventType === "ברית" ? String(rawEvent?.eventDateHebrew || "").trim() : "",
    eventTime: String(rawEvent?.eventTime || "").trim(),
    imageDataUrl: String(rawEvent?.imageDataUrl || "").trim(),
    groomName,
    brideName,
    batMitzvahName,
    parentName1,
    parentName2
  };

  if (eventType === "חתונה") {
    return { ...baseEvent, eventNames: `${groomName} & ${brideName}`.trim() };
  }
  if (eventType === "ברית") {
    return { ...baseEvent, eventNames: `${parentName1} ו${parentName2}`.trim() };
  }
  if (eventType === "בת מצווה") {
    return { ...baseEvent, eventNames: batMitzvahName };
  }
  return { ...baseEvent, eventNames: String(rawEvent?.eventNames || "").trim() };
}

export function validateEvent(normalizedEvent) {
  if (normalizedEvent.eventType === "חתונה") {
    if (!normalizedEvent.groomName || !normalizedEvent.brideName) {
      return "יש למלא שם חתן ושם כלה";
    }
  }
  return "";
}

export function normalizePaymentPayload(rawPayment) {
  const amountRaw = rawPayment?.amountPaid;
  let amountPaid = 0;
  if (amountRaw !== "" && amountRaw != null && !Number.isNaN(Number(amountRaw))) {
    amountPaid = Math.max(0, Number(amountRaw));
  }
  const paymentMethod =
    rawPayment?.paymentMethod == null ? "" : String(rawPayment.paymentMethod).trim();
  return { amountPaid, paymentMethod };
}
