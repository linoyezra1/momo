import { formatHebrewCalendarDate, formatIsraeliDate, formatIsraeliWeekday, parseIsoDateParts } from "../../utils/dateFormat";

export function getCountdownTarget(event) {
  const parts = parseIsoDateParts(event?.eventDate);
  if (!parts) return null;
  const timeRaw = String(event?.eventTime || "18:00").trim();
  const [hourRaw, minuteRaw] = timeRaw.split(":");
  const hours = Number(hourRaw);
  const minutes = Number(minuteRaw);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    Number.isFinite(hours) ? hours : 18,
    Number.isFinite(minutes) ? minutes : 0,
    0
  );
}

export function getDateParts(event) {
  const parts = parseIsoDateParts(event?.eventDate);
  if (!parts) {
    return { day: "—", month: "", year: "", weekday: "", hebrew: "", dots: "" };
  }
  const date = new Date(parts.year, parts.month - 1, parts.day);
  const monthName = date.toLocaleDateString("he-IL", { month: "long" });
  return {
    day: String(parts.day).padStart(2, "0"),
    month: monthName,
    year: String(parts.year),
    weekday: formatIsraeliWeekday(event.eventDate),
    hebrew: event?.eventDateHebrew?.trim() || formatHebrewCalendarDate(event.eventDate),
    dots: formatIsraeliDate(event.eventDate)
  };
}

export function getEventClosing(event) {
  if (!event) return "נשמח לראותכם בין אורחינו…";
  if (event.eventType === "חתונה") {
    return `נשמח לראותכם בין אורחינו, ${event.groomName || ""} ו${event.brideName || ""}`.trim();
  }
  if (event.eventType === "ברית") {
    return `נשמח לראותכם בין אורחינו, ${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim();
  }
  if (event.eventNames) {
    return `נשמח לראותכם בין אורחינו, ${event.eventNames}`.trim();
  }
  return "נשמח לראותכם בין אורחינו…";
}

export function buildWeddingSchedule(event) {
  const parts = parseIsoDateParts(event?.eventDate);
  if (!parts) return [];

  const timeRaw = String(event?.eventTime || "19:00").trim();
  const [h, m] = timeRaw.split(":").map((v) => Number(v));
  const ceremony = new Date(parts.year, parts.month - 1, parts.day, h || 19, m || 0);
  const addMinutes = (date, mins) => new Date(date.getTime() + mins * 60 * 1000);
  const fmt = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return [
    { time: fmt(addMinutes(ceremony, -90)), title: "קבלת פנים", icon: "toast", side: "right" },
    { time: fmt(ceremony), title: "חופה וקידושין", icon: "rings", side: "left" },
    { time: fmt(addMinutes(ceremony, 75)), title: "צילומים", icon: "camera", side: "right" },
    { time: fmt(addMinutes(ceremony, 120)), title: "ארוחת חגיגה", icon: "dinner", side: "left" },
    { time: fmt(addMinutes(ceremony, 180)), title: "ריקודים", icon: "dance", side: "right" }
  ];
}
