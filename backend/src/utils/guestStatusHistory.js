/**
 * Append-only guest.statusHistory entries for RSVP timeline UI.
 * Keep callHistory (phone attempts) separate — this tracks primary status changes.
 */

export const STATUS_HISTORY_SOURCES = {
  REP: "rep",
  PUBLIC_LINK: "public_link",
  WHATSAPP: "whatsapp",
  EXCEL: "excel",
  COUPLE: "couple",
  HOSTESS: "hostess",
  MANUAL: "manual"
};

export const STATUS_HISTORY_LABELS = {
  [STATUS_HISTORY_SOURCES.REP]: "נציג טלפוני",
  [STATUS_HISTORY_SOURCES.PUBLIC_LINK]: "אורח (קישור ציבורי)",
  [STATUS_HISTORY_SOURCES.WHATSAPP]: "אורח (וואטסאפ)",
  [STATUS_HISTORY_SOURCES.EXCEL]: "ייבוא אקסל",
  [STATUS_HISTORY_SOURCES.COUPLE]: "הזוג",
  [STATUS_HISTORY_SOURCES.HOSTESS]: "דיילת אירוע",
  [STATUS_HISTORY_SOURCES.MANUAL]: "הזוג (הוספה ידנית)"
};

export function buildStatusHistoryEntry({
  status,
  updatedBy,
  source,
  note = "",
  updatedAt = new Date()
} = {}) {
  const normalizedStatus = String(status ?? "").trim();
  const normalizedSource = String(source ?? "").trim();
  const label =
    String(updatedBy ?? "").trim() ||
    STATUS_HISTORY_LABELS[normalizedSource] ||
    "מערכת";

  return {
    status: normalizedStatus,
    updatedBy: label,
    source: normalizedSource || "system",
    note: String(note ?? "").trim(),
    updatedAt: updatedAt instanceof Date ? updatedAt : new Date(updatedAt || Date.now())
  };
}

/** Record only when the primary status value actually changes. */
export function shouldRecordStatusHistory(previousStatus, nextStatus) {
  const next = String(nextStatus ?? "").trim();
  if (!next) return false;
  return String(previousStatus ?? "").trim() !== next;
}

/**
 * Push onto a mongoose guest doc when status changes.
 * Call with previousStatus BEFORE assigning guest.status = next.
 */
export function pushStatusHistoryOnGuest(
  guest,
  { previousStatus, status, updatedBy, source, note = "", updatedAt } = {}
) {
  if (!guest) return null;
  const nextStatus = String(status ?? "").trim();
  const fromStatus =
    previousStatus !== undefined && previousStatus !== null ? previousStatus : guest.status;
  if (!shouldRecordStatusHistory(fromStatus, nextStatus)) return null;

  const entry = buildStatusHistoryEntry({
    status: nextStatus,
    updatedBy,
    source,
    note,
    updatedAt
  });
  if (!Array.isArray(guest.statusHistory)) {
    guest.statusHistory = [];
  }
  guest.statusHistory.push(entry);
  return entry;
}

/** Seed entry for Guest.create payloads. */
export function initialStatusHistoryEntry({ status, updatedBy, source, note = "" } = {}) {
  return buildStatusHistoryEntry({ status, updatedBy, source, note });
}

/**
 * Entry for $push in findOneAndUpdate, or null if status did not change.
 */
export function statusHistoryPushEntry({
  previousStatus,
  nextStatus,
  updatedBy,
  source,
  note = ""
} = {}) {
  if (!shouldRecordStatusHistory(previousStatus, nextStatus)) return null;
  return buildStatusHistoryEntry({
    status: nextStatus,
    updatedBy,
    source,
    note
  });
}
