const PACKAGE_TYPES = new Set(["custom", "digital", "vip_2_rounds", "vip_4_rounds"]);
export const DEAL_PAYMENT_METHODS = new Set(["bit", "paybox", "bank_transfer", "cash", "other"]);

export const FEATURE_KEYS = [
  "whatsappRound1",
  "whatsappRound2",
  "isPremiumWhatsappButtonsEnabled",
  "phoneCallsRound1",
  "phoneCallsRound2",
  "phoneCallsRound3",
  "phoneCallsRound4",
  "eventDayReminder",
  "eventDayTableNumber",
  "canSendTableWhatsApp",
  "thankYouMessage"
];

export const PAYMENT_METHOD_LABELS = {
  bit: "ביט",
  paybox: "פייבוקס",
  bank_transfer: "העברה בנקאית",
  cash: "מזומן",
  other: "אחר"
};

export const FEATURE_LABELS = {
  whatsappRound1: "סבב וואטסאפ 1",
  whatsappRound2: "סבב וואטסאפ 2",
  isPremiumWhatsappButtonsEnabled: "כפתורי RSVP בוואטסאפ",
  phoneCallsRound1: "סבב שיחות 1",
  phoneCallsRound2: "סבב שיחות 2",
  phoneCallsRound3: "סבב שיחות 3",
  phoneCallsRound4: "סבב שיחות 4",
  eventDayReminder: "תזכורת ביום האירוע",
  eventDayTableNumber: "מספר שולחן ביום האירוע",
  canSendTableWhatsApp: "שליחת מספר שולחן בוואטסאפ",
  thankYouMessage: "הודעת תודה"
};

/** Admin defaults (legacy schema-friendly). */
export function defaultIncludedFeatures() {
  return {
    whatsappRound1: true,
    whatsappRound2: false,
    isPremiumWhatsappButtonsEnabled: false,
    phoneCallsRound1: false,
    phoneCallsRound2: false,
    phoneCallsRound3: false,
    phoneCallsRound4: false,
    eventDayReminder: true,
    eventDayTableNumber: false,
    canSendTableWhatsApp: false,
    thankYouMessage: true
  };
}

/** Agent create form: no features pre-selected. */
export function emptyIncludedFeatures() {
  return {
    whatsappRound1: false,
    whatsappRound2: false,
    isPremiumWhatsappButtonsEnabled: false,
    phoneCallsRound1: false,
    phoneCallsRound2: false,
    phoneCallsRound3: false,
    phoneCallsRound4: false,
    eventDayReminder: false,
    eventDayTableNumber: false,
    canSendTableWhatsApp: false,
    thankYouMessage: false
  };
}

function parseOptionalNonNegativeNumber(value, existing) {
  if (value === undefined) return existing ?? null;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return existing ?? null;
  return Math.max(0, parsed);
}

/**
 * @param {object} rawDeal
 * @param {object} existingDeal
 * @param {{ featuresMode?: "admin" | "agent", allowCouponCode?: boolean }} [options]
 */
export function normalizeDealPayload(rawDeal = {}, existingDeal = {}, options = {}) {
  const featuresMode = options.featuresMode === "agent" ? "agent" : "admin";
  const allowCouponCode = options.allowCouponCode !== false;
  const existing = existingDeal?.toObject ? existingDeal.toObject() : existingDeal || {};
  const packageType = PACKAGE_TYPES.has(String(rawDeal?.packageType || "").trim())
    ? String(rawDeal.packageType).trim()
    : existing.packageType || "custom";

  const baseFeatures =
    featuresMode === "agent" && !existing.includedFeatures
      ? emptyIncludedFeatures()
      : {
          ...(featuresMode === "agent" ? emptyIncludedFeatures() : defaultIncludedFeatures()),
          ...(existing.includedFeatures || {})
        };

  // Fresh agent create: start from empty, then apply only explicit booleans from body
  const includedFeatures =
    featuresMode === "agent" && !Object.keys(existing.includedFeatures || {}).length
      ? { ...emptyIncludedFeatures() }
      : { ...baseFeatures };

  const incomingFeatures = rawDeal?.includedFeatures || {};
  for (const key of FEATURE_KEYS) {
    if (typeof incomingFeatures[key] === "boolean") {
      includedFeatures[key] = incomingFeatures[key];
    }
  }

  if (typeof incomingFeatures.canSendTableWhatsApp === "boolean") {
    includedFeatures.eventDayTableNumber = incomingFeatures.canSendTableWhatsApp;
    includedFeatures.canSendTableWhatsApp = incomingFeatures.canSendTableWhatsApp;
  } else if (typeof incomingFeatures.eventDayTableNumber === "boolean") {
    includedFeatures.canSendTableWhatsApp = incomingFeatures.eventDayTableNumber;
    includedFeatures.eventDayTableNumber = incomingFeatures.eventDayTableNumber;
  } else {
    const enabled = Boolean(
      includedFeatures.canSendTableWhatsApp || includedFeatures.eventDayTableNumber
    );
    includedFeatures.eventDayTableNumber = enabled;
    includedFeatures.canSendTableWhatsApp = enabled;
  }

  let paymentAmount = Number(existing.paymentAmount || 0);
  if (rawDeal?.paymentAmount !== undefined && rawDeal?.paymentAmount !== "") {
    const parsed = Number(rawDeal.paymentAmount);
    paymentAmount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  const methodRaw = String(rawDeal?.paymentMethod || existing.paymentMethod || "other").trim();
  const paymentMethod = DEAL_PAYMENT_METHODS.has(methodRaw) ? methodRaw : "other";

  const packagePrice = parseOptionalNonNegativeNumber(
    rawDeal?.packagePrice,
    existing.packagePrice ?? null
  );
  const supplierCost = parseOptionalNonNegativeNumber(
    rawDeal?.supplierCost,
    existing.supplierCost ?? null
  );

  let couponCode = String(existing.couponCode || "").trim();
  if (allowCouponCode && rawDeal?.couponCode != null) {
    couponCode = String(rawDeal.couponCode).trim();
  }

  return {
    packageType,
    includedFeatures,
    marketingSource:
      rawDeal?.marketingSource != null
        ? String(rawDeal.marketingSource).trim()
        : String(existing.marketingSource || "").trim(),
    paymentAmount,
    paymentMethod,
    adminNotes:
      rawDeal?.adminNotes != null
        ? String(rawDeal.adminNotes).trim()
        : String(existing.adminNotes || "").trim(),
    packageDescription:
      rawDeal?.packageDescription != null
        ? String(rawDeal.packageDescription).trim()
        : String(existing.packageDescription || "").trim(),
    packagePrice,
    supplierCost,
    couponCode,
    agentNotes:
      rawDeal?.agentNotes != null
        ? String(rawDeal.agentNotes).trim()
        : String(existing.agentNotes || "").trim()
  };
}

export function serializeDeal(deal, payment = {}, options = {}) {
  const normalized = normalizeDealPayload(deal || {}, deal || {}, options);
  if (!deal?.paymentAmount && payment?.amountPaid) {
    normalized.paymentAmount = Math.max(0, Number(payment.amountPaid) || 0);
  }
  if ((!deal?.paymentMethod || deal.paymentMethod === "other") && payment?.paymentMethod) {
    const legacy = String(payment.paymentMethod).trim().toLowerCase();
    if (DEAL_PAYMENT_METHODS.has(legacy)) {
      normalized.paymentMethod = legacy;
    }
  }
  return normalized;
}
