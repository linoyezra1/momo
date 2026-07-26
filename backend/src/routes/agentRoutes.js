import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import { publishDashboardEvent } from "../services/dashboardEvents.js";
import { listGuestAuditLogs, recordPhoneAttemptAudit } from "../services/guestAuditService.js";
import {
  requireAgent,
  signAgentToken,
  validateAgentCredentials,
  verifyAgentToken
} from "../middleware/agentAuth.js";
import { resolveMaxPhoneRounds } from "../utils/phoneRounds.js";
import {
  STATUS_HISTORY_SOURCES,
  statusHistoryPushEntry
} from "../utils/guestStatusHistory.js";

const router = express.Router();

function buildEventLabel(event) {
  if (!event) return "אירוע ללא שם";
  if (event.eventType === "חתונה") {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || "חתונה";
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || "בת מצווה";
  }
  return event.eventNames || event.eventType || "אירוע";
}

function getWhatsAppRoundsSent(guest) {
  return Math.max(
    0,
    Number(guest?.whatsappRoundsSentCount || 0),
    Number(guest?.reminderRound || 0)
  );
}

function isInAgentQueue(guest, maxPhoneRounds) {
  return (
    getWhatsAppRoundsSent(guest) >= 1 &&
    ["לא ידוע", "אולי"].includes(guest?.status) &&
    Number(guest?.phoneAttemptsCount || 0) < maxPhoneRounds
  );
}

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  const validation = validateAgentCredentials(username, password);
  if (validation.reason === "not_configured") {
    return res.status(503).json({ message: "התחברות נציג לא מוגדרת בשרת" });
  }
  if (!validation.ok) {
    return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
  }

  try {
    const token = signAgentToken();
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create agent session" });
  }
});

router.get("/session", (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!verifyAgentToken(token)) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true });
});

router.use(requireAgent);

router.get("/clients", async (_req, res) => {
  try {
    const users = await User.find({}, "username event createdAt").sort({ createdAt: -1 });
    const clients = users.map((user) => ({
      userId: user._id,
      username: user.username,
      eventLabel: buildEventLabel(user.event),
      eventType: user.event?.eventType || "",
      eventDate: user.event?.eventDate || ""
    }));
    return res.json({ clients });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load clients", error: error.message });
  }
});

router.get("/:userId/audit-logs", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const result = await listGuestAuditLogs({
      userId,
      limit: req.query.limit,
      skip: req.query.skip,
      guestId: req.query.guestId
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load audit logs" });
  }
});

router.get("/:userId/guests", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event username deal.includedFeatures");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const maxPhoneRounds = resolveMaxPhoneRounds(user);
    const candidates = await Guest.find({
      userId,
      status: { $in: ["לא ידוע", "אולי"] },
      $and: [
        {
          $or: [
            { whatsappRoundsSentCount: { $gte: 1 } },
            { reminderRound: { $gte: 1 } }
          ]
        },
        {
          $or: [
            { phoneAttemptsCount: { $lt: maxPhoneRounds } },
            { phoneAttemptsCount: { $exists: false } }
          ]
        }
      ]
    }).sort({ phoneAttemptsCount: 1, fullName: 1 });
    const guests = candidates.map((guest) => {
      const data = guest.toObject();
      data.whatsappRoundsSentCount = getWhatsAppRoundsSent(data);
      return data;
    });
    return res.json({
      userId,
      username: user.username,
      event: user.event,
      eventLabel: buildEventLabel(user.event),
      maxPhoneRounds,
      queueCount: guests.length,
      guests
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load guests", error: error.message });
  }
});

router.patch("/:userId/guests/:guestId/phone-rsvp", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const { callStatus, agentNotes, status, attendeesCount } = req.body;

    if (!["answered", "no_answer", "disconnected"].includes(callStatus)) {
      return res.status(400).json({ message: "יש לבחור תוצאת שיחה תקינה" });
    }

    const user = await User.findById(userId).select("event.maxPhoneRounds deal.includedFeatures");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const maxPhoneRounds = resolveMaxPhoneRounds(user);
    const existingGuest = await Guest.findOne({ _id: guestId, userId });
    if (!existingGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }
    if (!isInAgentQueue(existingGuest, maxPhoneRounds)) {
      return res.status(409).json({ message: "המוזמן כבר אינו זמין בתור השיחות הפעיל" });
    }

    const nextAttempt = Number(existingGuest.phoneAttemptsCount || 0) + 1;
    const update = {
      currentCallRound: Math.min(nextAttempt, 4),
      callStatus,
      agentNotes: String(agentNotes ?? "").trim(),
      callTimestamp: new Date()
    };

    const hasStatusUpdate = callStatus === "answered";

    if (hasStatusUpdate) {
      const nextStatus = String(status).trim();
      if (!["מגיע", "לא מגיע", "אולי"].includes(nextStatus)) {
        return res.status(400).json({ message: "סטטוס הגעה לא תקין" });
      }

      update.status = nextStatus;
      update.confirmationMethod = "phone";

      if (
        attendeesCount !== undefined &&
        attendeesCount !== null &&
        attendeesCount !== "" &&
        !Number.isNaN(Number(attendeesCount))
      ) {
        update.attendeesCount =
          nextStatus === "לא מגיע"
            ? Math.max(0, Number(attendeesCount))
            : Math.max(1, Number(attendeesCount));
      }
    }

    const historyEntry = {
      attemptNumber: nextAttempt,
      callRound: Math.min(nextAttempt, 4),
      callStatus,
      rsvpStatus: update.status || existingGuest.status,
      attendeesCount:
        typeof update.attendeesCount === "number"
          ? update.attendeesCount
          : Number(existingGuest.attendeesCount || 0),
      agentNotes: update.agentNotes,
      calledAt: update.callTimestamp
    };

    const pushOps = { callHistory: historyEntry };
    if (hasStatusUpdate) {
      const statusEntry = statusHistoryPushEntry({
        previousStatus: existingGuest.status,
        nextStatus: update.status,
        updatedBy: `נציג טלפוני — סבב ${Math.min(nextAttempt, 4)}`,
        source: STATUS_HISTORY_SOURCES.REP,
        note: update.agentNotes
      });
      if (statusEntry) {
        pushOps.statusHistory = statusEntry;
      }
    }

    const guest = await Guest.findOneAndUpdate(
      {
        _id: guestId,
        userId,
        status: { $in: ["לא ידוע", "אולי"] },
        $or: [
          { phoneAttemptsCount: { $lt: maxPhoneRounds } },
          { phoneAttemptsCount: { $exists: false } }
        ]
      },
      {
        $set: update,
        $inc: { phoneAttemptsCount: 1 },
        $push: pushOps
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!guest) {
      return res.status(409).json({ message: "המוזמן כבר אינו זמין בתור השיחות הפעיל" });
    }

    await recordPhoneAttemptAudit({
      userId,
      guest,
      callStatus,
      attemptNumber: nextAttempt,
      previousStatus: existingGuest.status,
      nextStatus: update.status,
      attendeesCount:
        typeof update.attendeesCount === "number"
          ? update.attendeesCount
          : undefined,
      agentNotes: update.agentNotes
    });

    publishDashboardEvent(userId, {
      type: "guest-phone-rsvp-updated",
      guestId: String(guest._id)
    });

    return res.json({
      message: "Phone RSVP saved",
      guest,
      removeFromQueue: !isInAgentQueue(guest, maxPhoneRounds),
      maxPhoneRounds
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save phone RSVP" });
  }
});

export default router;
