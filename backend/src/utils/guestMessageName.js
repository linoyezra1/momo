/**
 * Name inserted into an outgoing guest message.
 * The stored guest name stays unchanged.
 */
export function guestMessageName(fullName, { firstNameOnly = false, fallback = "" } = {}) {
  const trimmed = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  if (!firstNameOnly) return trimmed;
  return trimmed.split(" ")[0] || fallback;
}
