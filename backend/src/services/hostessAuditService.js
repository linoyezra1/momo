import SystemAuditLog from "../models/SystemAuditLog.js";

export const HOSTESS_AUDIT_SOURCE = "HOSTESS_MODULE";
export const HOSTESS_MARKED_BY = "HOSTESS";
export const HOSTESS_ARRIVED_STATUS = "הגיע לאירוע";

export async function recordHostessAudit({
  userId,
  action,
  status = "ok",
  phone = "",
  description,
  metadata = {}
}) {
  try {
    await SystemAuditLog.create({
      source: HOSTESS_AUDIT_SOURCE,
      action,
      status,
      phone: String(phone || "").trim(),
      userId: userId || null,
      description: String(description || "").trim(),
      metadata
    });
  } catch (error) {
    console.error(`[HOSTESS] Failed to write SystemAuditLog: ${error?.message || error}`);
  }
}
