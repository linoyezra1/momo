/**
 * Build Google Calendar "add event" URLs from momo event fields.
 * Title: wedding of groom & bride (or event names).
 * Location: venue + address.
 * Start: reception time when available, else ceremony/event time.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseDateParts(dateStr) {
  const raw = String(dateStr || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) };
  }
  return null;
}

function parseTimeParts(timeStr, fallbackHour = 19, fallbackMinute = 0) {
  const raw = String(timeStr || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]))),
    minute: Math.min(59, Math.max(0, Number(match[2])))
  };
}

function toGoogleDateStamp(parts) {
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}T${pad2(parts.hour)}${pad2(parts.minute)}00`;
}

export function buildEventCalendarTitle(event = {}) {
  const groom = String(event?.groomName || "").trim();
  const bride = String(event?.brideName || "").trim();
  if (groom && bride) return `החתונה של ${groom} ו${bride}`;
  const names = String(event?.eventNames || "").trim();
  if (names) return names;
  const bat = String(event?.batMitzvahName || "").trim();
  if (bat) return `אירוע של ${bat}`;
  return "אירוע";
}

export function buildEventCalendarLocation(event = {}) {
  const venue = String(event?.venueName || "").trim();
  const locationAddress = String(event?.locationAddress || "").trim();
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  const address = locationAddress || [street, city].filter(Boolean).join(", ");
  if (venue && address) return `${venue}, ${address}`;
  return venue || address || "";
}

/**
 * Google Calendar template URL for the event.
 * Start = receptionTime (קבלת פנים) when set, else eventTime.
 * Duration default: 5 hours.
 */
export function buildGoogleCalendarUrl(event = {}, { durationHours = 5 } = {}) {
  const dateParts = parseDateParts(event?.eventDate);
  if (!dateParts) return "";

  const startTime = parseTimeParts(
    event?.receptionTime || event?.eventTime || "",
    19,
    0
  );
  const start = { ...dateParts, ...startTime };
  const endDate = new Date(
    start.year,
    start.month - 1,
    start.day,
    start.hour,
    start.minute
  );
  endDate.setHours(endDate.getHours() + Math.max(1, Number(durationHours) || 5));
  const end = {
    year: endDate.getFullYear(),
    month: endDate.getMonth() + 1,
    day: endDate.getDate(),
    hour: endDate.getHours(),
    minute: endDate.getMinutes()
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: buildEventCalendarTitle(event),
    dates: `${toGoogleDateStamp(start)}/${toGoogleDateStamp(end)}`,
    details: "נוסף מהזמנה דיגיטלית של momoEVENT",
    location: buildEventCalendarLocation(event)
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
