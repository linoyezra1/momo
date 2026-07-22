const STORAGE_PREFIX = "momo:audit-log-last-read:";

export function getAuditLogLastReadAt(userId) {
  if (!userId || typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`) || "");
  } catch {
    return "";
  }
}

export function markAuditLogAsRead(userId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, new Date().toISOString());
  } catch {
    // Ignore storage failures (private mode / quota).
  }
}
