/**
 * Normalizes Israeli mobile numbers to local format: 05XXXXXXXX (10 digits).
 * Used before Excel precheck, DB comparison, and WhatsApp links.
 */
export function normalizeIsraeliPhone(phone) {
  if (phone == null || phone === "") return "";

  let value = String(phone).trim();
  if (typeof phone === "number" && Number.isFinite(phone)) {
    value = String(Math.trunc(phone));
  }

  value = value.replace(/[\s\-()]/g, "");

  if (value.startsWith("+972")) {
    value = `0${value.slice(4)}`;
  } else if (value.startsWith("972")) {
    value = `0${value.slice(3)}`;
  }

  value = value.replace(/\D/g, "");

  if (value.startsWith("5") && value.length === 9) {
    value = `0${value}`;
  }

  return value;
}
