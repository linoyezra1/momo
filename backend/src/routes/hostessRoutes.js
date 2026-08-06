import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import SeatingLayout from "../models/SeatingLayout.js";
import { isTwilioConfigured } from "../utils/twilioWhatsApp.js";
import {
  findValidActivationCode,
  mapTwilioErrorMessage,
  releaseActivationCredits,
  reserveActivationCredits
} from "../services/bulkWhatsAppService.js";
import {
  canSendTableWhatsApp,
  formatTableDisplayLabel,
  sendTableNumberWhatsApp
} from "../services/tableNumberWhatsApp.js";
import {
  HOSTESS_ARRIVED_STATUS,
  HOSTESS_MARKED_BY,
  recordHostessAudit
} from "../services/hostessAuditService.js";
import { publishDashboardEvent } from "../services/dashboardEvents.js";
import { guestForSeating } from "./seatingRoutes.js";
import { buildSeatingAnalytics, buildSeatingWarnings } from "../utils/seatingAssign.js";
import {
  STATUS_HISTORY_LABELS,
  STATUS_HISTORY_SOURCES,
  initialStatusHistoryEntry,
  pushStatusHistoryOnGuest
} from "../utils/guestStatusHistory.js";
import { normalizePhone } from "../utils/guestPhone.js";
import {
  buildHostessArrivedDescription,
  buildHostessGuestCreatedDescription,
  recordGuestAuditLog
} from "../services/guestAuditService.js";
import { getEventTypeNoun, isCoupleEventType } from "../utils/eventTypeWording.js";

const router = express.Router();

function buildEventLabel(event = {}) {
  if (isCoupleEventType(event.eventType)) {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || getEventTypeNoun(event.eventType);
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בר מצווה" || event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || event.eventType;
  }
  return event.eventNames || "אירוע";
}

function countGuestSeats(guest) {
  return Math.max(1, Number(guest?.attendeesCount) || 1);
}

function buildTablesWithAvailability(tables = [], guests = []) {
  return (tables || []).map((table) => {
    const seated = guests.filter((guest) => guest.seatingTableId === table.tableId);
    const occupied = seated.reduce((sum, guest) => sum + countGuestSeats(guest), 0);
    const capacity = Math.max(0, Number(table.capacity) || 0);
    const remaining = Math.max(0, capacity - occupied);
    return {
      tableId: table.tableId,
      label: table.label,
      name: table.name || "",
      displayLabel: formatTableDisplayLabel(table),
      shape: table.shape,
      capacity,
      occupied,
      remaining
    };
  });
}

router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(eventId).select("event deal");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const tables = layout?.tables || [];
    const tableById = new Map(tables.map((table) => [table.tableId, table]));
    const guests = await Guest.find({ userId: eventId }).sort({ fullName: 1 });
    const guestPayload = guests.map((guest) => {
      const base = guestForSeating(guest);
      const table = tableById.get(guest.seatingTableId);
      return {
        ...base,
        tableLabel: table ? formatTableDisplayLabel(table) : guest.seatingTableId ? "?" : ""
      };
    });

    return res.json({
      eventId: String(user._id),
      eventLabel: buildEventLabel(user.event),
      eventType: user.event?.eventType || "אירוע",
      event: user.event || null,
      features: {
        canSendTableWhatsApp: canSendTableWhatsApp(user)
      },
      tables: buildTablesWithAvailability(tables, guests),
      guests: guestPayload
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת מסך דיילת נכשלה" });
  }
});

router.post("/:eventId/guests", async (req, res) => {
  try {
    const { eventId } = req.params;
    const fullName = String(req.body?.fullName || "").trim();
    const rawPhone = String(req.body?.phone || "").trim();
    const attendeesCount = Math.max(1, Math.min(20, Number(req.body?.attendeesCount) || 1));

    if (!fullName) {
      return res.status(400).json({ message: "יש להזין שם מלא" });
    }

    const user = await User.findById(eventId).select("_id event");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    let phone = "";
    if (rawPhone) {
      phone = normalizePhone(rawPhone);
      if (!phone) {
        return res.status(400).json({ message: "מספר טלפון לא תקין" });
      }
      const existing = await Guest.findOne({ userId: eventId, phone });
      if (existing) {
        return res.status(409).json({
          message: "מוזמן עם מספר טלפון זה כבר קיים ברשימה",
          guestId: String(existing._id)
        });
      }
    }

    const status = HOSTESS_ARRIVED_STATUS;
    const arrivedAt = new Date();
    const guest = await Guest.create({
      userId: eventId,
      fullName,
      phone,
      attendeesCount,
      giftAmount: 0,
      status,
      source: "manual",
      hostessArrivedAt: arrivedAt,
      arrivalMarkedBy: HOSTESS_MARKED_BY,
      statusHistory: [
        initialStatusHistoryEntry({
          status,
          updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.HOSTESS],
          source: STATUS_HISTORY_SOURCES.HOSTESS,
          note: "נוסף ע״י דיילת — לא היה ברשימת המוזמנים"
        })
      ]
    });

    await recordHostessAudit({
      userId: eventId,
      action: "HOSTESS_ADD_GUEST",
      status: "ok",
      phone: guest.phone,
      description: `${guest.fullName} נוסף/ה ע״י דיילת (לא היה ברשימת המוזמנים) · הגיע לאירוע`,
      metadata: {
        guestId: String(guest._id),
        guestName: guest.fullName,
        attendeesCount: guest.attendeesCount,
        nextStatus: status,
        markedBy: HOSTESS_MARKED_BY,
        hostessArrivedAt: arrivedAt.toISOString()
      }
    });

    await recordGuestAuditLog({
      userId: eventId,
      guestId: guest._id,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      actor: "hostess",
      channel: "hostess",
      action: "guest_created",
      description: buildHostessGuestCreatedDescription(guest),
      performerLabel: "דיילת אירוע",
      metadata: {
        note: "לא היה ברשימת המוזמנים",
        markedBy: HOSTESS_MARKED_BY
      },
      changes: {
        status: { to: guest.status },
        attendeesCount: { to: guest.attendeesCount }
      }
    });

    publishDashboardEvent(eventId, {
      type: "guest-created",
      guestId: String(guest._id)
    });

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const allGuests = await Guest.find({ userId: eventId });

    return res.status(201).json({
      guest: {
        ...guestForSeating(guest),
        tableLabel: ""
      },
      tables: buildTablesWithAvailability(layout?.tables || [], allGuests),
      message: "המוזמן נוסף בהצלחה"
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "הוספת מוזמן נכשלה" });
  }
});

router.post("/:eventId/guests/:guestId/arrive", async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const user = await User.findById(eventId).select("_id event");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const existing = await Guest.findOne({ _id: guestId, userId: eventId });
    if (!existing) return res.status(404).json({ message: "המוזמן לא נמצא" });

    const previousStatus = existing.status;
    const arrivedAt = new Date();

    pushStatusHistoryOnGuest(existing, {
      previousStatus,
      status: HOSTESS_ARRIVED_STATUS,
      updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.HOSTESS],
      source: STATUS_HISTORY_SOURCES.HOSTESS,
      note: "סומן כהגיע לאירוע",
      updatedAt: arrivedAt
    });
    existing.status = HOSTESS_ARRIVED_STATUS;
    existing.hostessArrivedAt = arrivedAt;
    existing.arrivalMarkedBy = HOSTESS_MARKED_BY;
    if (existing.declinedWhileSeatedAt) {
      existing.declinedWhileSeatedAt = undefined;
    }
    await existing.save();

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const table = (layout?.tables || []).find((item) => item.tableId === existing.seatingTableId);
    const tableLabel = table ? formatTableDisplayLabel(table) : existing.seatingTableId ? "?" : "";

    await recordHostessAudit({
      userId: eventId,
      action: "HOSTESS_ARRIVED",
      status: "ok",
      phone: existing.phone,
      description: `${existing.fullName} סומן כ'הגיע לאירוע' על ידי דיילת אירוע`,
      metadata: {
        guestId: String(existing._id),
        guestName: existing.fullName,
        previousStatus,
        nextStatus: HOSTESS_ARRIVED_STATUS,
        markedBy: HOSTESS_MARKED_BY,
        markedByLabel: "סומן על ידי דיילת אירוע",
        tableLabel,
        hostessArrivedAt: arrivedAt.toISOString()
      }
    });

    await recordGuestAuditLog({
      userId: eventId,
      guestId: existing._id,
      guestName: existing.fullName,
      guestPhone: existing.phone,
      actor: "hostess",
      channel: "hostess",
      action: "status_change",
      description: buildHostessArrivedDescription(existing),
      performerLabel: "דיילת אירוע",
      metadata: {
        markedBy: HOSTESS_MARKED_BY,
        tableLabel
      },
      changes: {
        status: { from: previousStatus, to: HOSTESS_ARRIVED_STATUS }
      }
    });

    publishDashboardEvent(eventId, {
      type: "guest-hostess-arrived",
      guestId: String(existing._id)
    });

    return res.json({
      guest: guestForSeating(existing),
      tableLabel,
      status: HOSTESS_ARRIVED_STATUS,
      markedBy: HOSTESS_MARKED_BY,
      message: tableLabel
        ? `${existing.fullName} יושב/ת בשולחן ${tableLabel}`
        : `${existing.fullName} עדיין לא משובץ/ת לשולחן`
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "סימון הגעה נכשל" });
  }
});

router.post("/:eventId/guests/:guestId/assign-table", async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const tableId = String(req.body?.tableId || "").trim();
    if (!tableId) {
      return res.status(400).json({ message: "יש לבחור שולחן" });
    }

    const user = await User.findById(eventId).select("_id");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const guest = await Guest.findOne({ _id: guestId, userId: eventId });
    if (!guest) return res.status(404).json({ message: "המוזמן לא נמצא" });

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const table = (layout?.tables || []).find((item) => item.tableId === tableId);
    if (!table) return res.status(404).json({ message: "השולחן לא נמצא" });

    const allGuests = await Guest.find({ userId: eventId });
    const occupied = allGuests
      .filter((item) => item.seatingTableId === tableId && String(item._id) !== String(guest._id))
      .reduce((sum, item) => sum + countGuestSeats(item), 0);
    const needed = countGuestSeats(guest);
    const capacity = Math.max(0, Number(table.capacity) || 0);
    if (occupied + needed > capacity) {
      return res.status(400).json({
        message: `אין מספיק מקומות פנויים בשולחן ${table.label || tableId}`
      });
    }

    guest.seatingTableId = tableId;
    if (guest.declinedWhileSeatedAt) guest.declinedWhileSeatedAt = undefined;
    await guest.save();

    const refreshed = await Guest.find({ userId: eventId });
    const tables = layout?.tables || [];

    const tableLabel = formatTableDisplayLabel(table, tableId);

    await recordHostessAudit({
      userId: eventId,
      action: "HOSTESS_ASSIGN_TABLE",
      status: "ok",
      phone: guest.phone,
      description: `${guest.fullName} שובץ/ה לשולחן ${tableLabel} על ידי דיילת`,
      metadata: {
        guestId: String(guest._id),
        guestName: guest.fullName,
        tableId,
        tableLabel,
        markedBy: HOSTESS_MARKED_BY
      }
    });

    publishDashboardEvent(eventId, {
      type: "guest-seating-updated",
      guestId: String(guest._id)
    });

    return res.json({
      success: true,
      guest: {
        ...guestForSeating(guest),
        tableLabel
      },
      tableLabel,
      tables: buildTablesWithAvailability(tables, refreshed),
      warnings: buildSeatingWarnings(refreshed, tables),
      analytics: buildSeatingAnalytics(refreshed, tables),
      message: `שובץ/ה לשולחן ${tableLabel}`
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "שיבוץ לשולחן נכשל" });
  }
});

router.post("/:eventId/guests/:guestId/send-table-whatsapp", async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const paymentCode = String(req.body?.paymentCode || req.body?.couponCode || "").trim();
    const user = await User.findById(eventId);
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    if (!canSendTableWhatsApp(user)) {
      return res.status(403).json({
        success: false,
        code: "feature_disabled",
        message: "השירות כרוך בעלות נוספת, יש לפנות לתמיכה בטלפון"
      });
    }

    if (!isTwilioConfigured()) {
      return res.status(503).json({ message: "שירות שליחת הודעות לא מוגדר בשרת" });
    }

    const { codeRecord, error: codeError } = await findValidActivationCode(paymentCode);
    if (codeError === "missing_code") {
      return res.status(400).json({ message: "יש להזין קוד קופון לרכישה זו" });
    }
    if (codeError === "invalid_code" || codeError === "expired_code") {
      return res.status(400).json({ message: "קוד הקופון אינו תקין או שפג תוקפו" });
    }

    const guest = await Guest.findOne({ _id: guestId, userId: eventId });
    if (!guest) return res.status(404).json({ message: "המוזמן לא נמצא" });
    if (!normalizePhone(guest.phone)) {
      return res.status(400).json({ message: "למוזמן אין מספר טלפון — לא ניתן לשלוח WhatsApp" });
    }
    if (!guest.seatingTableId) {
      return res.status(400).json({ message: "המוזמן עדיין לא משובץ לשולחן" });
    }

    const reserved = await reserveActivationCredits(codeRecord, 1);
    if (!reserved.ok) {
      return res.status(400).json({ success: false, message: reserved.message });
    }

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const table = (layout?.tables || []).find((item) => item.tableId === guest.seatingTableId);
    const tableLabel = table
      ? formatTableDisplayLabel(table, guest.seatingTableId)
      : guest.seatingTableId;
    const result = await sendTableNumberWhatsApp({
      user,
      guest,
      table,
      tableLabel: table?.label || guest.seatingTableId
    });

    if (!result.ok) {
      await releaseActivationCredits(reserved.codeRecord._id, 1);
      await recordHostessAudit({
        userId: eventId,
        action: "HOSTESS_TABLE_WHATSAPP",
        status: "failed",
        phone: guest.phone,
        description: `שליחת מספר שולחן ל-${guest.fullName} נכשלה`,
        metadata: {
          guestId: String(guest._id),
          guestName: guest.fullName,
          tableLabel: result.tableLabel || tableLabel,
          markedBy: HOSTESS_MARKED_BY,
          reason: result.reason || "send_failed"
        }
      });
      return res.status(400).json({
        success: false,
        message: result.message || mapTwilioErrorMessage(result.error)
      });
    }

    if (!reserved.codeRecord.redeemedByUserId) {
      try {
        reserved.codeRecord.redeemedByUserId = user._id;
        await reserved.codeRecord.save();
      } catch {
        /* non-fatal */
      }
    }

    const sentLabel = result.tableLabel || tableLabel;

    await recordHostessAudit({
      userId: eventId,
      action: "HOSTESS_TABLE_WHATSAPP",
      status: "ok",
      phone: guest.phone,
      description: `נשלח מספר שולחן (${sentLabel}) ב-WhatsApp ל${guest.fullName} על ידי דיילת אירוע`,
      metadata: {
        guestId: String(guest._id),
        guestName: guest.fullName,
        tableLabel: sentLabel,
        markedBy: HOSTESS_MARKED_BY,
        markedByLabel: "סומן על ידי דיילת אירוע"
      }
    });

    return res.json({
      success: true,
      tableLabel: sentLabel,
      message: "נשלח בהצלחה! ✓"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: mapTwilioErrorMessage(error) || "שליחת ההודעה נכשלה"
    });
  }
});

export default router;
