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
import { getEventTypeNoun, isCoupleEventType } from "../utils/eventTypeWording.js";
import { createCoupleClient } from "../services/createCoupleClient.js";
import {
  normalizeDealPayload,
  PAYMENT_METHOD_LABELS,
  serializeDeal
} from "../utils/dealPayload.js";
import {
  applyPhoneRoundsToDealFeatures,
  maxPhoneRoundsFromDealFeatures
} from "../utils/phoneRounds.js";
import { normalizePaymentPayload } from "../utils/eventPayload.js";
import {
  listClientCouponsWithSupplierCost,
  sumSupplierCostFromCoupons
} from "../utils/supplierCost.js";
import { coverUpload } from "../middleware/coverUpload.js";
import { isCoverStorageConfigured } from "../services/coverStorage.js";
import { clearEventCover, uploadAndAttachCover } from "../utils/eventCover.js";

const router = express.Router();

function buildEventLabel(event) {
  if (!event) return "אירוע ללא שם";
  if (isCoupleEventType(event.eventType)) {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || getEventTypeNoun(event.eventType);
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בר מצווה" || event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || event.eventType;
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

function agentCanAccessUser(user, agent) {
  if (!user || !agent) return false;
  if (agent.isMainAgent === true) return true;
  return String(user?.createdByAgentId || "").trim() === String(agent.id || "").trim();
}

async function findAgentAccessibleUser(userId, agent, select) {
  const query = User.findById(userId);
  if (select) query.select(select);
  const user = await query;
  if (!user) return { error: { status: 404, message: "Client not found" } };
  if (!agentCanAccessUser(user, agent)) {
    return { error: { status: 403, message: "אין הרשאה לאירוע זה" } };
  }
  return { user };
}

function serializeAgentClient(user, coupons = []) {
  const payment = normalizePaymentPayload(user.payment || {});
  const deal = serializeDeal(user.deal || {}, payment, {
    featuresMode: "agent",
    allowCouponCode: false
  });
  const supplierCostTotal = sumSupplierCostFromCoupons(coupons);
  return {
    userId: user._id,
    username: user.username,
    loginPassword: user.loginPassword || "",
    contactPhone: user.contactPhone || "",
    eventLabel: buildEventLabel(user.event),
    eventType: user.event?.eventType || "",
    eventDate: user.event?.eventDate || "",
    event: user.event,
    deal: {
      ...deal,
      couponCode: String(user.deal?.couponCode || "").trim(),
      supplierCost: supplierCostTotal
    },
    packageDescription: deal.packageDescription || "",
    packagePrice: deal.packagePrice,
    supplierCost: supplierCostTotal,
    agentNotes: deal.agentNotes || "",
    couponCode: String(user.deal?.couponCode || "").trim(),
    coupons,
    createdAt: user.createdAt
  };
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
    const token = signAgentToken(validation.agent);
    return res.json({
      token,
      agent: validation.agent
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create agent session" });
  }
});

router.get("/session", (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const payload = verifyAgentToken(token);
  if (!payload) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    agent: {
      id: payload.agentId,
      username: payload.username,
      displayName: payload.displayName,
      isMainAgent: payload.isMainAgent === true
    }
  });
});

router.use(requireAgent);

router.get("/clients", async (req, res) => {
  try {
    const agent = req.agent;
    const filter = agent.isMainAgent ? {} : { createdByAgentId: agent.id };
    const users = await User.find(
      filter,
      "username event createdAt payment deal loginPassword contactPhone createdByAgentId managedBy"
    ).sort({ createdAt: -1 });

    const clients = await Promise.all(
      users.map(async (user) => {
        const coupons = await listClientCouponsWithSupplierCost(user._id);
        return serializeAgentClient(user, coupons);
      })
    );

    const supplierCostGrandTotal = clients.reduce(
      (sum, client) => sum + (Number(client.supplierCost) || 0),
      0
    );

    return res.json({
      clients,
      agent: req.agent,
      scope: agent.isMainAgent ? "all" : "owned",
      supplierCostGrandTotal: Math.round(supplierCostGrandTotal * 100) / 100
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load clients", error: error.message });
  }
});

router.post("/create-client", async (req, res) => {
  try {
    const result = await createCoupleClient({
      body: req.body,
      req,
      managedBy: "agent",
      createdByAgentId: req.agent.id,
      featuresMode: "agent",
      allowCouponCode: false,
      welcomeManagerName: req.agent.displayName || req.agent.username || "momoEVENT"
    });

    return res.status(201).json({
      userId: result.user._id,
      ...result.links,
      credentials: { username: result.user.username, password: result.plainPassword },
      client: serializeAgentClient(result.user),
      welcomeWhatsApp: {
        sent: Boolean(result.welcomeWhatsApp?.sent),
        reason: result.welcomeWhatsApp?.reason || null
      }
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      message: error.message || "Failed to create client",
      ...(status === 500 ? { error: error.message } : {})
    });
  }
});

router.patch("/clients/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const owned = await findAgentAccessibleUser(userId, req.agent);
    if (owned.error) {
      return res.status(owned.error.status).json({ message: owned.error.message });
    }
    const user = owned.user;
    const rawDeal = req.body?.deal && typeof req.body.deal === "object" ? { ...req.body.deal } : {};
    // Agents cannot edit coupon or supplier cost (derived from coupons)
    delete rawDeal.couponCode;
    delete rawDeal.supplierCost;

    const deal = normalizeDealPayload(rawDeal, user.deal || {}, {
      featuresMode: "agent",
      allowCouponCode: false
    });
    // Preserve existing coupon
    deal.couponCode = String(user.deal?.couponCode || "").trim();

    const maxFromDeal = maxPhoneRoundsFromDealFeatures(deal.includedFeatures);
    deal.includedFeatures = applyPhoneRoundsToDealFeatures(maxFromDeal, deal.includedFeatures);
    user.deal = deal;
    user.set(
      "event.isPremiumWhatsappButtonsEnabled",
      Boolean(deal.includedFeatures.isPremiumWhatsappButtonsEnabled)
    );
    user.set("event.maxPhoneRounds", maxFromDeal);
    user.markModified("event");
    user.payment = {
      amountPaid:
        deal.packagePrice != null ? Number(deal.packagePrice) || 0 : deal.paymentAmount || 0,
      paymentMethod: PAYMENT_METHOD_LABELS[deal.paymentMethod] || deal.paymentMethod
    };

    await user.save();
    return res.json({
      message: "Client updated",
      client: serializeAgentClient(user)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update client" });
  }
});

router.get("/:userId/audit-logs", async (req, res) => {
  try {
    const { userId } = req.params;
    const owned = await findAgentAccessibleUser(userId, req.agent, "_id createdByAgentId");
    if (owned.error) {
      return res.status(owned.error.status).json({ message: owned.error.message });
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
    const owned = await findAgentAccessibleUser(
      userId,
      req.agent,
      "event username deal.includedFeatures createdByAgentId"
    );
    if (owned.error) {
      return res.status(owned.error.status).json({ message: owned.error.message });
    }
    const user = owned.user;

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

    const owned = await findAgentAccessibleUser(
      userId,
      req.agent,
      "event.maxPhoneRounds deal.includedFeatures createdByAgentId"
    );
    if (owned.error) {
      return res.status(owned.error.status).json({ message: owned.error.message });
    }
    const user = owned.user;
    const maxPhoneRounds = resolveMaxPhoneRounds(user);
    const existingGuest = await Guest.findOne({ _id: guestId, userId });
    if (!existingGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }
    if (!isInAgentQueue(existingGuest, maxPhoneRounds)) {
      return res.status(409).json({ message: "המוזמן כבר אינו זמין בתור השיחות הפעיל" });
    }

    const nextAttempt = Number(existingGuest.phoneAttemptsCount || 0) + 1;
    const agentLabel = req.agent.displayName || req.agent.username || "נציג טלפוני";
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
        updatedBy: `${agentLabel} — סבב ${Math.min(nextAttempt, 4)}`,
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
        typeof update.attendeesCount === "number" ? update.attendeesCount : undefined,
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

router.post("/clients/:userId/event/cover", coverUpload.single("cover"), async (req, res) => {
  try {
    if (!isCoverStorageConfigured()) {
      return res.status(503).json({
        message:
          "אחסון תמונות לא מוגדר. יש להגדיר CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ו-CLOUDINARY_API_SECRET"
      });
    }
    const owned = await findAgentAccessibleUser(req.params.userId, req.agent);
    if (owned.error) {
      return res.status(owned.error.status).json({ message: owned.error.message });
    }
    const cover = await uploadAndAttachCover(owned.user, req.file);
    return res.json({ message: "תמונת הקאבר הועלתה בהצלחה", cover, event: owned.user.event });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "העלאת התמונה נכשלה" });
  }
});

router.delete("/clients/:userId/event/cover", async (req, res) => {
  try {
    const owned = await findAgentAccessibleUser(req.params.userId, req.agent);
    if (owned.error) {
      return res.status(owned.error.status).json({ message: owned.error.message });
    }
    await clearEventCover(owned.user);
    return res.json({ message: "תמונת הקאבר הוסרה", event: owned.user.event });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "מחיקת התמונה נכשלה" });
  }
});

export default router;
