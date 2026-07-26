import GuestAuditLog from "../models/GuestAuditLog.js";
import { publishDashboardEvent } from "./dashboardEvents.js";

export function resolvePerformerLabel({ actor, channel, metadata = {} }) {
  if (actor === "agent" && channel === "phone") {
    const round = metadata.attemptNumber || metadata.callRound || 1;
    return `נציג טלפוני — סבב ${round}`;
  }
  if (actor === "guest" && channel === "whatsapp") return "האורח (וואטסאפ)";
  if (actor === "guest" && channel === "web") return "האורח (קישור)";
  if (actor === "client" && channel === "import") {
    const source = String(metadata.source || "").trim();
    if (source === "contacts" || source === "CONTACTS_IMPORT") {
      return "הזוג (ייבוא מאנשי קשר)";
    }
    return "הזוג (ייבוא אקסל)";
  }
  if (actor === "client") return "הזוג";
  return "מערכת";
}

function formatGuestCountPart(status, attendeesCount) {
  if (typeof attendeesCount !== "number") return "";
  if (status === "לא מגיע") return "";
  return ` (**${attendeesCount}** אורחים)`;
}

export function buildClientUpdateDescription(before = {}, after = {}) {
  const status = after.status || before.status || "לא ידוע";
  const count =
    typeof after.attendeesCount === "number"
      ? after.attendeesCount
      : before.attendeesCount;

  return `עודכן ע"י הזוג: **${status}**${formatGuestCountPart(status, count)}`;
}

export function buildPhoneAttemptDescription({
  callStatus,
  attemptNumber,
  status,
  attendeesCount,
  agentNotes = ""
}) {
  const round = attemptNumber || 1;
  const notes = String(agentNotes || "").trim();
  const notesPart = notes ? ` · הערה: "${notes}"` : "";

  if (callStatus === "answered" && status) {
    const countPart = formatGuestCountPart(status, attendeesCount);
    return `שיחה טלפונית (**סבב ${round}**): סטטוס עודכן ל-**${status}**${countPart}${notesPart}`;
  }

  if (callStatus === "disconnected") {
    return `שיחה טלפונית (**סבב ${round}**): השיחה נותקה${notesPart}`;
  }

  return `שיחה טלפונית (**סבב ${round}**): לא היה מענה${notesPart}`;
}

export function buildGuestSelfUpdateDescription(before = {}, after = {}) {
  const status = after.status || before.status || "לא ידוע";
  const count =
    typeof after.attendeesCount === "number"
      ? after.attendeesCount
      : before.attendeesCount;

  return `אישור הגעה עצמאי: עודכן ל-**${status}**${formatGuestCountPart(status, count)}`;
}

export function buildGuestCreatedDescription(guest = {}) {
  const status = guest.status || "לא ידוע";
  const count = Number(guest.attendeesCount);
  return `הוספת מוזמן: **${status}**${formatGuestCountPart(status, Number.isFinite(count) ? count : undefined)}`;
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
  attendeesCount,
  agentNotes = ""
}) {
  const notes = String(agentNotes || "").trim();
  const description = buildPhoneAttemptDescription({
    callStatus,
    attemptNumber,
    status: nextStatus,
    attendeesCount,
    agentNotes: notes
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
    metadata: {
      callStatus,
      attemptNumber,
      callRound: attemptNumber,
      agentNotes: notes
    },
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

export async function countGuestAuditLogsSince({ userId, since }) {
  const query = { userId };
  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      query.createdAt = { $gt: sinceDate };
    }
  }
  return GuestAuditLog.countDocuments(query);
}
