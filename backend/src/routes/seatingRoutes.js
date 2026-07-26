import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import SeatingLayout from "../models/SeatingLayout.js";
import {
  buildSeatingAnalytics,
  buildSeatingWarnings,
  isGuestEligibleForSeating
} from "../utils/seatingAssign.js";
import { isTwilioConfigured } from "../utils/twilioWhatsApp.js";
import {
  findValidActivationCode,
  mapTwilioErrorMessage,
  releaseActivationCredits,
  reserveActivationCredits
} from "../services/bulkWhatsAppService.js";
import {
  canSendTableWhatsApp,
  sendTableNumberWhatsApp
} from "../services/tableNumberWhatsApp.js";

const router = express.Router();

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultLayout() {
  return {
    tables: [
      {
        tableId: makeId("tbl"),
        label: "1",
        shape: "round",
        capacity: 10,
        x: 80,
        y: 80,
        width: 96,
        height: 96
      },
      {
        tableId: makeId("tbl"),
        label: "2",
        shape: "round",
        capacity: 10,
        x: 220,
        y: 80,
        width: 96,
        height: 96
      }
    ],
    venueElements: []
  };
}

function formatDeclineDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("he-IL");
  } catch {
    return "";
  }
}

export function guestForSeating(guest) {
  const isSeated = Boolean(guest.seatingTableId);
  const isDeclinedWhileSeated = isSeated && guest.status === "לא מגיע";
  const declinedAt = guest.declinedWhileSeatedAt || (isDeclinedWhileSeated ? guest.updatedAt : null);
  return {
    _id: guest._id,
    fullName: guest.fullName,
    phone: guest.phone,
    attendeesCount: guest.attendeesCount,
    status: guest.status,
    source: guest.source,
    guestSide: guest.guestSide || "",
    guestGroup: guest.guestGroup || "",
    seatingTableId: guest.seatingTableId || "",
    isSeated,
    isEligible: isGuestEligibleForSeating(guest),
    isDeclinedWhileSeated,
    declinedWhileSeatedAt: declinedAt || null,
    declinedWhileSeatedLabel: isDeclinedWhileSeated
      ? `מוזמן זה אושב אך עודכן שלא יגיע בתאריך ${formatDeclineDate(declinedAt) || "לא ידוע"}`
      : "",
    hostessArrivedAt: guest.hostessArrivedAt || null,
    arrivalMarkedBy: guest.arrivalMarkedBy || "",
    updatedAt: guest.updatedAt
  };
}

function serializeTableDispatch(dispatch = {}) {
  return {
    scheduledAt: dispatch.scheduledAt || null,
    status: dispatch.status || "idle",
    lastSentAt: dispatch.lastSentAt || null,
    lastError: dispatch.lastError || "",
    sentCount: Number(dispatch.sentCount || 0)
  };
}

function featureFlagsForUser(user) {
  const enabled = canSendTableWhatsApp(user);
  return {
    canSendTableWhatsApp: enabled,
    eventDayTableNumber: enabled
  };
}

async function dispatchTableMessages({ user, paymentCode }) {
  const layout = await SeatingLayout.findOne({ userId: user._id });
  const tableById = new Map((layout?.tables || []).map((table) => [table.tableId, table]));
  const guests = await Guest.find({
    userId: user._id,
    seatingTableId: { $ne: "" },
    status: { $in: ["מגיע", "אולי", "הגיע לאירוע"] }
  });

  if (!guests.length) {
    return { ok: false, status: 400, message: "אין אורחים משובצים לשולחן עם סטטוס מגיע/אולי" };
  }

  const { codeRecord, error: codeError } = await findValidActivationCode(paymentCode);
  if (codeError === "missing_code") {
    return { ok: false, status: 400, message: "יש להזין קוד קופון לרכישה זו" };
  }
  if (codeError === "invalid_code" || codeError === "expired_code") {
    return { ok: false, status: 400, message: "קוד הקופון אינו תקין או שפג תוקפו" };
  }

  const reserved = await reserveActivationCredits(codeRecord, guests.length);
  if (!reserved.ok) {
    return { ok: false, status: 400, message: reserved.message };
  }

  let sent = 0;
  let lastError = null;

  for (const guest of guests) {
    const table = tableById.get(guest.seatingTableId);
    const result = await sendTableNumberWhatsApp({
      user,
      guest,
      tableLabel: table?.label || guest.seatingTableId
    });
    if (result.ok) {
      sent += 1;
    } else {
      lastError = result;
    }
  }

  const failed = guests.length - sent;
  if (failed > 0) {
    await releaseActivationCredits(reserved.codeRecord._id, failed);
  }

  if (!reserved.codeRecord.redeemedByUserId) {
    try {
      reserved.codeRecord.redeemedByUserId = user._id;
      await reserved.codeRecord.save();
    } catch {
      /* non-fatal */
    }
  }

  if (sent === 0) {
    return {
      ok: false,
      status: 400,
      message: lastError?.message || mapTwilioErrorMessage(lastError?.error) || "לא נשלחה אף הודעה"
    };
  }

  return {
    ok: true,
    sentCount: sent,
    message: `נשלחו ${sent} הודעות עם מספר שולחן`
  };
}

async function processDueTableDispatch(user) {
  const job = user.tableDispatch || {};
  if (job.status !== "scheduled" || !job.scheduledAt) return null;
  if (new Date(job.scheduledAt).getTime() > Date.now()) return null;
  if (!canSendTableWhatsApp(user)) {
    user.tableDispatch = {
      ...job,
      status: "failed",
      lastError: "הפיצ׳ר אינו פעיל לאירוע זה"
    };
    await user.save();
    return { processed: true, ok: false, message: user.tableDispatch.lastError };
  }

  const result = await dispatchTableMessages({ user, paymentCode: job.paymentCode });
  user.tableDispatch = {
    scheduledAt: job.scheduledAt,
    paymentCode: "",
    status: result.ok ? "sent" : "failed",
    lastSentAt: result.ok ? new Date() : job.lastSentAt || null,
    lastError: result.ok ? "" : result.message || "",
    sentCount: result.sentCount || 0
  };
  await user.save();
  return { processed: true, ...result };
}

router.get("/:userId/seating", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event deal tableDispatch");
    if (!user) return res.status(404).json({ message: "Client not found" });

    await processDueTableDispatch(user);

    let layout = await SeatingLayout.findOne({ userId });
    if (!layout) {
      const seed = defaultLayout();
      layout = await SeatingLayout.create({ userId, ...seed });
    }

    const guests = await Guest.find({ userId }).sort({ fullName: 1 });
    const seatingGuests = guests.map(guestForSeating);
    const analytics = buildSeatingAnalytics(guests, layout.tables);
    const warnings = buildSeatingWarnings(guests, layout.tables);

    return res.json({
      layout: {
        tables: layout.tables,
        venueElements: layout.venueElements || []
      },
      tables: layout.tables,
      venueElements: layout.venueElements || [],
      guests: seatingGuests,
      eligibleGuests: seatingGuests.filter((guest) => guest.isEligible),
      analytics,
      warnings,
      event: user.event,
      features: featureFlagsForUser(user),
      tableDispatch: serializeTableDispatch(user.tableDispatch),
      hostessPath: `/hostess/${userId}`
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load seating" });
  }
});

router.put("/:userId/seating/layout", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "Client not found" });

    const tables = Array.isArray(req.body?.tables) ? req.body.tables : [];
    const venueElements = Array.isArray(req.body?.venueElements) ? req.body.venueElements : [];

    const layout = await SeatingLayout.findOneAndUpdate(
      { userId },
      { tables, venueElements },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const guests = await Guest.find({ userId });
    return res.json({
      message: "פריסת האולם נשמרה",
      layout: { tables: layout.tables, venueElements: layout.venueElements },
      tables: layout.tables,
      venueElements: layout.venueElements || [],
      warnings: buildSeatingWarnings(guests, layout.tables),
      analytics: buildSeatingAnalytics(guests, layout.tables)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save layout" });
  }
});

router.patch("/:userId/seating/assign", async (req, res) => {
  try {
    const { userId } = req.params;
    const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
    const unassignGuestIds = Array.isArray(req.body?.unassignGuestIds) ? req.body.unassignGuestIds : [];

    if (!assignments.length && !unassignGuestIds.length) {
      return res.status(400).json({ message: "No seating changes provided" });
    }

    for (const guestId of unassignGuestIds) {
      await Guest.findOneAndUpdate(
        { _id: guestId, userId },
        { $set: { seatingTableId: "" }, $unset: { declinedWhileSeatedAt: 1 } }
      );
    }

    for (const item of assignments) {
      if (!item?.guestId) continue;
      await Guest.findOneAndUpdate(
        { _id: item.guestId, userId },
        {
          $set: { seatingTableId: String(item.tableId || "").trim() },
          $unset: { declinedWhileSeatedAt: 1 }
        }
      );
    }

    const guests = await Guest.find({ userId });
    const layout = await SeatingLayout.findOne({ userId });
    const tables = layout?.tables || [];

    return res.json({
      message: "שיבוץ עודכן",
      guests: guests.map(guestForSeating),
      warnings: buildSeatingWarnings(guests, tables),
      analytics: buildSeatingAnalytics(guests, tables)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update seating" });
  }
});

router.post("/:userId/seating/send-table-messages", async (req, res) => {
  try {
    const { userId } = req.params;
    const paymentCode = String(req.body?.paymentCode || req.body?.couponCode || "").trim();
    const scheduledAtRaw = req.body?.scheduledAt;
    const sendNow = req.body?.sendNow === true || !scheduledAtRaw;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Client not found" });

    if (!canSendTableWhatsApp(user)) {
      return res.status(403).json({
        success: false,
        code: "feature_disabled",
        message:
          "שליחת מספר שולחן ב-WhatsApp דורשת הפעלה ע״י מנהל המערכת ורכישת קופון מתאים"
      });
    }

    if (!isTwilioConfigured()) {
      return res.status(503).json({ message: "שירות שליחת הודעות לא מוגדר בשרת" });
    }

    if (!paymentCode) {
      return res.status(400).json({ message: "יש להזין קוד קופון לרכישה זו" });
    }

    const { codeRecord, error: codeError } = await findValidActivationCode(paymentCode);
    if (codeError === "missing_code") {
      return res.status(400).json({ message: "יש להזין קוד קופון לרכישה זו" });
    }
    if (codeError === "invalid_code" || codeError === "expired_code") {
      return res.status(400).json({ message: "קוד הקופון אינו תקין או שפג תוקפו" });
    }

    if (!sendNow) {
      const scheduledAt = new Date(scheduledAtRaw);
      if (Number.isNaN(scheduledAt.getTime())) {
        return res.status(400).json({ message: "שעת השליחה אינה תקינה" });
      }
      if (scheduledAt.getTime() > Date.now() + 60 * 1000) {
        const seatedCount = await Guest.countDocuments({
          userId,
          seatingTableId: { $ne: "" },
          status: { $in: ["מגיע", "אולי", "הגיע לאירוע"] }
        });
        if (!seatedCount) {
          return res.status(400).json({
            message: "אין אורחים משובצים לשולחן עם סטטוס מגיע/אולי"
          });
        }
        if (Number(codeRecord.remaining_credits || 0) < seatedCount) {
          return res.status(400).json({
            message: `קנית מכסה בסך של ${codeRecord.total_credits} הודעות. נשארו לך ${codeRecord.remaining_credits} הודעות לניצול.`
          });
        }

        user.tableDispatch = {
          scheduledAt,
          paymentCode: String(codeRecord.code || paymentCode).trim().toUpperCase(),
          status: "scheduled",
          lastSentAt: user.tableDispatch?.lastSentAt || null,
          lastError: "",
          sentCount: 0
        };
        await user.save();
        return res.json({
          success: true,
          scheduled: true,
          message: `השליחה תוזמנה ל-${scheduledAt.toLocaleString("he-IL")}`,
          tableDispatch: serializeTableDispatch(user.tableDispatch)
        });
      }
    }

    const result = await dispatchTableMessages({ user, paymentCode });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message
      });
    }

    user.tableDispatch = {
      scheduledAt: null,
      paymentCode: "",
      status: "sent",
      lastSentAt: new Date(),
      lastError: "",
      sentCount: result.sentCount || 0
    };
    await user.save();

    return res.json({
      success: true,
      message: result.message,
      sentCount: result.sentCount,
      tableDispatch: serializeTableDispatch(user.tableDispatch)
    });
  } catch (error) {
    console.error("[Twilio] send-table-messages error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: mapTwilioErrorMessage(error) || "Failed to send table messages"
    });
  }
});

export default router;
