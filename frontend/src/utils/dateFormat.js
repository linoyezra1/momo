function parseIsoDateParts(dateStr) {
  const raw = String(dateStr ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!isoMatch) return null;
  return {
    year: Number(isoMatch[1]),
    month: Number(isoMatch[2]),
    day: Number(isoMatch[3])
  };
}

export function formatIsraeliDate(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return String(dateStr ?? "").trim();
  const { year, month, day } = parts;
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

export function formatIsraeliWeekday(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("he-IL", { weekday: "long" });
}

/** DD.MM.YYYY — לדף הזמנה (ברית) */
export function formatDateDots(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** תאריך עברי — מחושב מהתאריך הלועזי; ריק אם אין תאריך תקין */
export function formatHebrewCalendarDate(dateStr) {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  const date = new Date(year, month - 1, day);
  try {
    return date.toLocaleDateString("he-IL-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return "";
  }
}
