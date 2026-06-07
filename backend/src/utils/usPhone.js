export function normalizeUsPhone(phone) {
  if (phone == null || phone === "") return "";

  let value = String(phone).trim();
  value = value.replace(/[\s\-().]/g, "");
  if (value.startsWith("+")) {
    value = value.slice(1);
  }
  value = value.replace(/\D/g, "");

  if (value.length === 10) {
    return value;
  }

  if (value.length === 11 && value.startsWith("1")) {
    return value.slice(1);
  }

  return value;
}

export function formatStoredPhone(phone) {
  const normalized = normalizeUsPhone(phone);
  return normalized || String(phone || "").trim();
}
