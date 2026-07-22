export function normalizePhone(phone) {
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

/** Common stored / inbound forms of the same Israeli mobile for DB `$in` lookups. */
export function phoneLookupVariants(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const local = normalized.startsWith("0") ? normalized : `0${normalized}`;
  const national = local.startsWith("0") ? local.slice(1) : local;
  const e164 = `+972${national}`;
  const e164Digits = `972${national}`;

  return [...new Set([local, national, e164, e164Digits, `0${national}`].filter(Boolean))];
}

export function isSelfConfirmedSource(source) {
  return source === "form" || source === "excel_and_form";
}

export function resolveSourceAfterSelfRsvp(existing) {
  if (!existing) return "form";
  if (existing.source === "excel" || existing.status === "לא ידוע") {
    return "excel_and_form";
  }
  if (existing.source === "excel_and_form") {
    return "excel_and_form";
  }
  return "form";
}
