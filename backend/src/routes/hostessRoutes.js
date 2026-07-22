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

    const guest = await Guest.findOneAndUpdate(
      { _id: guestId, userId: eventId },
      { hostessArrivedAt: new Date() },
      { new: true }
    );
    if (!guest) return res.status(404).json({ message: "המוזמן לא נמצא" });

    const layout = await SeatingLayout.findOne({ userId: eventId });
    const table = (layout?.tables || []).find((item) => item.tableId === guest.seatingTableId);
    const tableLabel = table?.label || (guest.seatingTableId ? "?" : "");

    return res.json({
      guest: guestForSeating(guest),
      tableLabel,
      message: tableLabel
        ? `${guest.fullName} יושב/ת בשולחן ${tableLabel}`
        : `${guest.fullName} עדיין לא משובץ/ת לשולחן`
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
    const result = await sendTableNumberWhatsApp({
      user,
      guest,
      tableLabel: table?.label || guest.seatingTableId
    });

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message || mapTwilioErrorMessage(result.error)
      });
    }

    return res.json({
      success: true,
      message: `מספר השולחן נשלח ל-${guest.fullName} ב-WhatsApp`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: mapTwilioErrorMessage(error) || "שליחת ההודעה נכשלה"
    });
  }
});

export default router;
