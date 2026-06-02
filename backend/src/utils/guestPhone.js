export function normalizePhone(phone) {
  let value = String(phone ?? "").trim();
  if (typeof phone === "number" && Number.isFinite(phone)) {
    value = String(Math.trunc(phone));
  }
  if (!value) return "";
  value = value.replace(/[^\d]/g, "");
  if (value.startsWith("5") && value.length === 9) {
    value = `0${value}`;
  }
  return value;
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
