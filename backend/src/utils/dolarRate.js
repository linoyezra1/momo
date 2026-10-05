/**
 * Server FX rate: Twilio USD → ILS.
 *
 * DOLAR can be either:
 * - a number: DOLAR=3.07
 * - a URL that returns Frankfurter-style JSON:
 *   DOLAR=https://api.frankfurter.app/latest?from=USD&to=ILS
 *   → { "rates": { "ILS": 3.0653 } }
 *
 * Aliases: DOLLAR, USD_TO_ILS
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cachedRate = null;
let cachedAt = 0;
let inflight = null;

function readDolarEnv() {
  return String(process.env.DOLAR ?? process.env.DOLLAR ?? process.env.USD_TO_ILS ?? "").trim();
}

function parseNumericRate(raw) {
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

function isHttpUrl(raw) {
  return /^https?:\/\//i.test(raw);
}

function extractIlsRate(payload) {
  if (payload == null) return null;
  if (typeof payload === "number") return parseNumericRate(payload);

  const rates = payload.rates || payload.Rates || null;
  if (rates && rates.ILS != null) return parseNumericRate(rates.ILS);
  if (rates && rates.ils != null) return parseNumericRate(rates.ils);

  if (payload.ILS != null) return parseNumericRate(payload.ILS);
  if (payload.rate != null) return parseNumericRate(payload.rate);
  if (payload.value != null) return parseNumericRate(payload.value);

  return null;
}

async function fetchRateFromUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`FX HTTP ${response.status}`);
    }
    const payload = await response.json();
    const rate = extractIlsRate(payload);
    if (rate == null) {
      throw new Error("FX response missing ILS rate");
    }
    return rate;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve USD→ILS rate from DOLAR (number or Frankfurter URL).
 * Cached for 1 hour when fetched from URL.
 */
export async function getDolarRate() {
  const raw = readDolarEnv();
  if (!raw) return null;

  if (!isHttpUrl(raw)) {
    return parseNumericRate(raw);
  }

  const now = Date.now();
  if (cachedRate != null && now - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const rate = await fetchRateFromUrl(raw);
      cachedRate = rate;
      cachedAt = Date.now();
      console.log(`[FX] DOLAR rate refreshed from URL: 1 USD = ${rate} ILS`);
      return rate;
    } catch (error) {
      console.error(`[FX] Failed to fetch DOLAR URL: ${error?.message || error}`);
      // Keep last good cache if available
      if (cachedRate != null) return cachedRate;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Convert USD amount to ILS. Pass rate from getDolarRate(). */
export function usdToIls(usdAmount, rate) {
  if (rate == null || !Number.isFinite(Number(rate)) || Number(rate) <= 0) return null;
  const usd = Number(usdAmount) || 0;
  return Math.round(usd * Number(rate) * 100) / 100;
}
