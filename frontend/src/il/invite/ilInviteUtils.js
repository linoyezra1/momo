import { DEFAULT_WELCOME_TEXT } from "../../utils/ilEventPreview.js";
import { formatIsraeliDate, formatIsraeliWeekday, parseIsoDateParts } from "../../utils/dateFormat";

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

export function getWelcomeText(event) {
  return String(event?.welcomeText || "").trim() || DEFAULT_WELCOME_TEXT;
}

export function getWeddingNames(event) {
  const bride = String(event?.brideName || "").trim();
  const groom = String(event?.groomName || "").trim();
  if (bride && groom) return `${bride} & ${groom}`;
  if (bride || groom) return bride || groom;
  return "—";
}

export function getFullAddress(event) {
  const street = String(event?.streetAndNumber || "").trim();
  const city = String(event?.city || "").trim();
  return [street, city].filter(Boolean).join(", ") || "—";
}

export function getVenueLine(event) {
  const venue = String(event?.venueName || "").trim();
  const address = getFullAddress(event);
  if (!venue) return address;
  return `באולמי "${venue}", ${address}`;
}

export function getFullDateText(event) {
  if (!event?.eventDate) return "—";
  return formatIsraeliDate(event.eventDate);
}

export function getWeekdayLine(event) {
  if (!event?.eventDate) return "—";
  return `יום ${formatIsraeliWeekday(event.eventDate)}`;
}

function subtractMinutesFromTime(timeStr, minutesToSubtract) {
  const [h, m] = String(timeStr || "20:00").split(":").map((v) => Number(v));
  const base = new Date(2000, 0, 1, h || 20, m || 0, 0);
  base.setMinutes(base.getMinutes() - minutesToSubtract);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

export function getParallelTimeline(event) {
  const ceremonyTime = String(event?.eventTime || "20:30").trim();
  const receptionTime =
    String(event?.receptionTime || "").trim() || subtractMinutesFromTime(ceremonyTime, 60);

  return [
    {
      key: "reception",
      label: "קבלת פנים",
      time: receptionTime,
      gifSrc: "/images/il-invite/timeline-cocktail.gif",
      icon: "cocktail"
    },
    {
      key: "ceremony",
      label: "חופה וקידושין",
      time: ceremonyTime,
      gifSrc: "/images/il-invite/timeline-rings.gif",
      icon: "rings"
    }
  ];
}

export function getEventDisplayName(event) {
  if (event?.eventType === "חתונה") return getWeddingNames(event);
  if (event?.eventType === "בת מצווה") return event?.batMitzvahName || "—";
  if (event?.eventNames) return event.eventNames;
  if (event?.eventType === "ברית") {
    return `${event?.parentName1 || ""} ו${event?.parentName2 || ""}`.trim() || "—";
  }
  return "—";
}
