import GuestAuditLog from "../models/GuestAuditLog.js";
import { publishDashboardEvent } from "./dashboardEvents.js";

const CALL_STATUS_LABELS = {
  answered: "ענה",
  no_answer: "לא ענה",
  disconnected: "מנותק"
};

export function resolvePerformerLabel({ actor, channel, metadata = {} }) {
  if (actor === "agent" && channel === "phone") {
    const round = metadata.attemptNumber || metadata.callRound || 1;
    return `נציג טלפוני — סבב ${round}`;
  }
  if (actor === "guest" && channel === "whatsapp") return "האורח (וואטסאפ)";
  if (actor === "guest" && channel === "web") return "האורח (קישור)";
  if (actor === "client" && channel === "import") return "הזוג (ייבוא אקסל)";
  if (actor === "client") return "הזוג";
  return "מערכת";
}

export function buildStatusChangeDescription(fromStatus, toStatus) {
  if (!fromStatus || fromStatus === toStatus) {
    return `סטטוס: ${toStatus}`;
  }
  return `שינוי סטטוס: ${fromStatus} → ${toStatus}`;
}

export function buildAttendeesChangeDescription(fromCount, toCount) {
  return `עדכון כמות מגיעים: ${fromCount} → ${toCount}`;
}

export function buildClientUpdateDescription(before = {}, after = {}) {
  const parts = [];

  if (before.status !== after.status && after.status) {
    parts.push(buildStatusChangeDescription(before.status, after.status));
  }
  if (
    before.attendeesCount !== after.attendeesCount &&
    typeof after.attendeesCount === "number"
  ) {
    parts.push(buildAttendeesChangeDescription(before.attendeesCount ?? 0, after.attendeesCount));
  }

  return parts.join(" · ") || "עדכון פרטי מוזמן";
}

export function buildPhoneAttemptDescription({
  callStatus,
  attemptNumber,
  status,
  attendeesCount,
  previousStatus
}) {
  const roundLabel = `סבב ${attemptNumber}`;
  const callLabel = CALL_STATUS_LABELS[callStatus] || callStatus;

  if (callStatus === "answered" && status) {
    const countPart =
      typeof attendeesCount === "number" && status !== "לא מגיע"
        ? ` (${attendeesCount} מוזמנים)`
        : "";
    if (previousStatus && previousStatus !== status) {
      return `עדכון בשיחה ${roundLabel}: ${buildStatusChangeDescription(previousStatus, status)}${countPart}`;
    }
    return `עדכון בשיחה ${roundLabel}: ${status}${countPart}`;
  }

  return `שיחה ${roundLabel}: ${callLabel}`;
}

export function buildGuestSelfUpdateDescription(before = {}, after = {}) {
  const parts = buildClientUpdateDescription(before, after);
  if (parts === "עדכון פרטי מוזמן" && after.status) {
    return `עדכון עצמאי: ${after.status}${
      after.status === "מגיע" && after.attendeesCount ? ` (${after.attendeesCount} מוזמנים)` : ""
    }`;
  }
  return `עדכון עצמאי · ${parts}`;
}

function resolveActionFromChanges(before = {}, after = {}, fallback = "guest_updated") {
  const statusChanged = before.status !== after.status && after.status;
  const attendeesChanged =
    before.attendeesCount !== after.attendeesCount && typeof after.attendeesCount === "number";

  if (statusChanged && attendeesChanged) return "rsvp_update";
  if (statusChanged) return "status_change";
  if (attendeesChanged) return "attendees_change";
  return fallback;
}

export async function recordGuestAuditLog({
  userId,
  guestId,
  guestName,
  guestPhone,
  actor,
  channel,
  action,
  description,
  performerLabel,
  metadata = {},
  changes = {}
}) {
  if (!userId || !guestId || !description) return null;

  const entry = await GuestAuditLog.create({
    userId,
    guestId,
    guestName: String(guestName || "").trim(),
    guestPhone: String(guestPhone || "").trim(),
    actor,
    channel,
    action,
    description,
    performerLabel: performerLabel || resolvePerformerLabel({ actor, channel, metadata }),
    metadata,
    changes
  });

  publishDashboardEvent(userId, {
    type: "guest-audit-log-updated",
    guestId: String(guestId),
    auditLogId: String(entry._id)
  });

  return entry;
}

export async function recordClientGuestUpdate({ userId, before, after, channel = "dashboard" }) {
  const statusChanged = before.status !== after.status;
  const attendeesChanged = before.attendeesCount !== after.attendeesCount;
  if (!statusChanged && !attendeesChanged) return null;

  const description = buildClientUpdateDescription(
    {
      status: before.status,
      attendeesCount: before.attendeesCount
    },
    {
      status: after.status,
      attendeesCount: after.attendeesCount
    }
  );

  return recordGuestAuditLog({
    userId,
    guestId: after._id,
    guestName: after.fullName,
    guestPhone: after.phone,
    actor: "client",
    channel,
    action: resolveActionFromChanges(before, after),
    description,
    metadata: {},
    changes: {
      status: { from: before.status, to: after.status },
      attendeesCount: { from: before.attendeesCount, to: after.attendeesCount }
    }
  });
}

export async function recordGuestSelfUpdate({ guest, before, channel }) {
  const after = {
    status: guest.status,
    attendeesCount: guest.attendeesCount
  };

  return recordGuestAuditLog({
    userId: guest.userId,
    guestId: guest._id,
    guestName: guest.fullName,
    guestPhone: guest.phone,
    actor: "guest",
    channel,
    action: resolveActionFromChanges(before, after, "rsvp_update"),
    description: buildGuestSelfUpdateDescription(before, after),
    metadata: {},
    changes: {
      status: { from: before.status, to: after.status },
      attendeesCount: { from: before.attendeesCount, to: after.attendeesCount }
    }
  });
}

export async function recordPhoneAttemptAudit({
  userId,
  guest,
  callStatus,
  attemptNumber,
  previousStatus,
  nextStatus,
  attendeesCount
}) {
  const description = buildPhoneAttemptDescription({
    callStatus,
    attemptNumber,
    status: nextStatus,
    attendeesCount,
    previousStatus
  });

  const action =
    callStatus === "answered" && nextStatus
      ? resolveActionFromChanges(
          { status: previousStatus },
          { status: nextStatus, attendeesCount },
          "phone_attempt"
        )
      : "phone_attempt";

  return recordGuestAuditLog({
    userId,
    guestId: guest._id,
    guestName: guest.fullName,
    guestPhone: guest.phone,
    actor: "agent",
    channel: "phone",
    action,
    description,
    metadata: { callStatus, attemptNumber, callRound: attemptNumber },
    changes: {
      callStatus,
      status: nextStatus ? { from: previousStatus, to: nextStatus } : undefined,
      attendeesCount:
        typeof attendeesCount === "number" ? { to: attendeesCount } : undefined
    }
  });
}

export async function listGuestAuditLogs({ userId, limit = 50, skip = 0, guestId }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const query = { userId };
  if (guestId) query.guestId = guestId;

  const [entries, total] = await Promise.all([
    GuestAuditLog.find(query).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit).lean(),
    GuestAuditLog.countDocuments(query)
  ]);

  return {
    entries,
    total,
    limit: safeLimit,
    skip: safeSkip,
    hasMore: safeSkip + entries.length < total
  };
}
