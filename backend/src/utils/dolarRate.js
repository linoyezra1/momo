/**
 * Server FX rate: Twilio USD → ILS.
 * Set Railway/env: DOLAR=3.7 (shekels per 1 USD).
 * Aliases: DOLLAR, USD_TO_ILS
 */
export function getDolarRate() {
  const raw = process.env.DOLAR ?? process.env.DOLLAR ?? process.env.USD_TO_ILS;
  const rate = Number(String(raw ?? "").trim());
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

/** Convert USD amount to ILS using DOLAR. Returns null if rate is not configured. */
export function usdToIls(usdAmount, rate = getDolarRate()) {
  if (rate == null) return null;
  const usd = Number(usdAmount) || 0;
  return Math.round(usd * rate * 100) / 100;
}
