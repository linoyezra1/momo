/** Vendor domain shapes (JSDoc) — mirrors the product model contracts. */

/**
 * @typedef {Object} GlobalVendor
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} contactName
 * @property {string} phone
 * @property {string} email
 * @property {string} notes
 * @property {string} [createdAt]
 */

/**
 * @typedef {'OFFER_SENT'|'NEGOTIATING'|'BOOKED'|'REJECTED'} EventVendorStatus
 */

/**
 * @typedef {Object} EventVendor
 * @property {string} id
 * @property {string} eventId
 * @property {string} vendorId
 * @property {number} quoteAmount
 * @property {number} vendorQuoteAmount
 * @property {number} couplePrice
 * @property {number} [profit]
 * @property {EventVendorStatus} status
 * @property {string} eventNotes
 * @property {string} attachmentUrl
 * @property {GlobalVendor|null} [vendor]
 */

/**
 * @typedef {'PENDING'|'PARTIAL'|'PAID'} CouplePaymentStatus
 */

/**
 * @typedef {Object} EventFinance
 * @property {number} targetCoupleBudget
 * @property {CouplePaymentStatus} couplePaymentStatus
 * @property {string} couplePaymentNotes
 */

export const VENDOR_CATEGORIES = [
  "אולם / גן אירועים",
  "קייטרינג",
  "צלם",
  "וידאו",
  "דיג'יי / מוזיקה",
  "פרחים / עיצוב",
  "איפור ושיער",
  "שמלות / חליפות",
  "הפקה",
  "אחר"
];

export const EVENT_VENDOR_STATUS_LABELS = {
  OFFER_SENT: "הצעה נשלחה",
  NEGOTIATING: "במשא ומתן",
  BOOKED: "נסגר",
  REJECTED: "לא רלוונטי"
};

export const EVENT_VENDOR_STATUS_OPTIONS = Object.entries(EVENT_VENDOR_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

export function formatIls(amount) {
  const value = Number(amount) || 0;
  return `₪${value.toLocaleString("he-IL")}`;
}

export function toWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppHref(phone) {
  const intl = toWhatsAppPhone(phone);
  return intl ? `https://wa.me/${intl}` : "";
}

export function buildTelHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : "";
}
