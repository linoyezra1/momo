/**
 * Money/price field helpers — empty string while typing, number on submit.
 */

export function normalizeMoneyInput(raw) {
  if (raw === "" || raw == null) return "";
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return cleaned === "." ? "0." : "";
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return cleaned;
}

export function moneyToNumber(value) {
  if (value === "" || value == null) return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, num);
}

export function moneyFromStored(value) {
  const num = Number(value);
  if (!num) return "";
  return String(num);
}
