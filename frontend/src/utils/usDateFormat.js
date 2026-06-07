export function formatUsLongDate(dateStr) {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  return raw;
}

export function formatUsShortDate(dateStr) {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US");
  }

  return raw;
}
