import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import SeatingLayout from "../models/SeatingLayout.js";
import { isTwilioConfigured } from "../utils/twilioWhatsApp.js";
import { mapTwilioErrorMessage } from "../services/bulkWhatsAppService.js";
import {
  canSendTableWhatsApp,
  sendTableNumberWhatsApp
} from "../services/tableNumberWhatsApp.js";
import {
  HOSTESS_ARRIVED_STATUS,
  HOSTESS_MARKED_BY,
  recordHostessAudit
} from "../services/hostessAuditService.js";
import { publishDashboardEvent } from "../services/dashboardEvents.js";
import { guestForSeating } from "./seatingRoutes.js";

const router = express.Router();

function buildEventLabel(event = {}) {
  if (event.eventType === "חתונה") {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || "חתונה";
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || "בת מצווה";
  }
  return event.eventNames || "אירוע";
}

router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(eventId).select("event deal");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const tableById = new Map((layout?.tables || []).map((table) => [table.tableId, table]));
    const guests = await Guest.find({ userId: eventId }).sort({ fullName: 1 });

    return res.json({
      eventId: String(user._id),
      eventLabel: buildEventLabel(user.event),
      eventType: user.event?.eventType || "אירוע",
      event: user.event || null,
      features: {
        canSendTableWhatsApp: canSendTableWhatsApp(user)
      },
      guests: guests.map((guest) => {
        const base = guestForSeating(guest);
        const table = tableById.get(guest.seatingTableId);
        return {
          ...base,
          tableLabel: table?.label || (guest.seatingTableId ? "?" : "")
        };
      })
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת מסך דיילת נכשלה" });
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

    existing.status = HOSTESS_ARRIVED_STATUS;
    existing.hostessArrivedAt = arrivedAt;
    existing.arrivalMarkedBy = HOSTESS_MARKED_BY;
    if (existing.declinedWhileSeatedAt) {
      existing.declinedWhileSeatedAt = undefined;
    }
    await existing.save();

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const table = (layout?.tables || []).find((item) => item.tableId === existing.seatingTableId);
    const tableLabel = table?.label || (existing.seatingTableId ? "?" : "");

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

router.post("/:eventId/guests/:guestId/send-table-whatsapp", async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const user = await User.findById(eventId);
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

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

    const guest = await Guest.findOne({ _id: guestId, userId: eventId });
    if (!guest) return res.status(404).json({ message: "המוזמן לא נמצא" });
    if (!guest.seatingTableId) {
      return res.status(400).json({ message: "המוזמן עדיין לא משובץ לשולחן" });
    }

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const table = (layout?.tables || []).find((item) => item.tableId === guest.seatingTableId);
    const tableLabel = table?.label || guest.seatingTableId;
    const result = await sendTableNumberWhatsApp({
      user,
      guest,
      tableLabel
    });

    if (!result.ok) {
      await recordHostessAudit({
        userId: eventId,
        action: "HOSTESS_TABLE_WHATSAPP",
        status: "failed",
        phone: guest.phone,
        description: `שליחת מספר שולחן ל-${guest.fullName} נכשלה`,
        metadata: {
          guestId: String(guest._id),
          guestName: guest.fullName,
          tableLabel,
          markedBy: HOSTESS_MARKED_BY,
          reason: result.reason || "send_failed"
        }
      });
      return res.status(400).json({
        success: false,
        message: result.message || mapTwilioErrorMessage(result.error)
      });
    }

    await recordHostessAudit({
      userId: eventId,
      action: "HOSTESS_TABLE_WHATSAPP",
      status: "ok",
      phone: guest.phone,
      description: `נשלח מספר שולחן (${tableLabel}) ב-WhatsApp ל${guest.fullName} על ידי דיילת אירוע`,
      metadata: {
        guestId: String(guest._id),
        guestName: guest.fullName,
        tableLabel,
        markedBy: HOSTESS_MARKED_BY,
        markedByLabel: "סומן על ידי דיילת אירוע"
      }
    });

    return res.json({
      success: true,
      tableLabel,
      message: "נשלח בהצלחה! ✉️"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: mapTwilioErrorMessage(error) || "שליחת ההודעה נכשלה"
    });
  }
});

export default router;
