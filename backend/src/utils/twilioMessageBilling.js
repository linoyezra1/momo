/**
 * Twilio WhatsApp message billing helpers.
 * Twilio Price is USD (often negative, e.g. "-0.03530" for marketing templates).
 * Admin sums the absolute USD amount Twilio actually charged.
 */

/** Fallback only for inbound messages when Twilio does not send Price on the inbound webhook. */
export const DEFAULT_INBOUND_COST_USD = 0.005;

export const BILLABLE_MESSAGE_STATUSES = ["sent", "delivered", "read"];
export const FAILED_MESSAGE_STATUSES = ["failed", "undelivered"];

export function parseTwilioPrice(price) {
  if (price == null || price === "") return null;
  const value = Math.abs(Number.parseFloat(String(price)));
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * Resolve billed USD amount from Twilio Price.
 * Returns null when Price is missing — caller should not invent outbound costs.
 */
export function resolveActualCostUsd({ price, fallbackUsd = null } = {}) {
  const fromTwilio = parseTwilioPrice(price);
  if (fromTwilio != null) return fromTwilio;
  if (fallbackUsd != null && Number.isFinite(Number(fallbackUsd))) {
    return Math.abs(Number(fallbackUsd));
  }
  return null;
}

export function isBillableMessageStatus(status) {
  return BILLABLE_MESSAGE_STATUSES.includes(String(status || "").trim().toLowerCase());
}

export function isFailedMessageStatus(status) {
  return FAILED_MESSAGE_STATUSES.includes(String(status || "").trim().toLowerCase());
}
