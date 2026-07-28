import { normalizeIsraeliPhone } from "./phoneNormalize.js";

export function isSelfConfirmedGuest(guest = {}) {
  const source = String(guest.source || "").trim();
  return source === "form" || source === "excel_and_form";
}

export function formatGuestDuplicateStatus(guest = {}) {
  const source = String(guest.source || "").trim();
  if (source === "form" || source === "excel_and_form") {
    return "אישר עצמאית";
  }

  const status = String(guest.status || "לא ידוע").trim();
  const count = Math.max(1, Number(guest.attendeesCount) || 1);

  if (status === "מגיע" || status === "אולי" || status === "הגיע לאירוע") {
    return `${count} מגיעים`;
  }
  if (status === "לא מגיע") {
    return "לא מגיע";
  }
  return status;
}

export function buildGuestDuplicateMessage({ existing, incoming }) {
  const existingName = existing?.fullName || "—";
  const incomingName = incoming?.fullName || "—";
  const incomingCount = Math.max(1, Number(incoming?.attendeesCount) || 1);
  const statusLabel = formatGuestDuplicateStatus(existing);

  return `המוזמן ${existingName} כבר קיים במערכת עם מספר טלפון זה (סטטוס: ${statusLabel}). האם אתה בטוח שברצונך להחליף אותו ב-${incomingName} עם כמות מגיעים של ${incomingCount}?`;
}

export function findGuestByPhone(guests, phone) {
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return null;
  return (guests || []).find((guest) => normalizeIsraeliPhone(guest.phone) === normalized) || null;
}

export function indexGuestsByPhone(guests = []) {
  const map = new Map();
  guests.forEach((guest) => {
    const phone = normalizeIsraeliPhone(guest.phone);
    if (phone && !map.has(phone)) map.set(phone, guest);
  });
  return map;
}
