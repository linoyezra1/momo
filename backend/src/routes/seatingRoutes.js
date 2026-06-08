import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import SeatingLayout from "../models/SeatingLayout.js";
import {
  autoAssignGuestsToTables,
  buildSeatingAnalytics,
  buildSeatingWarnings,
  isGuestEligibleForSeating
} from "../utils/seatingAssign.js";
import { sendTwilioWhatsAppMessage, toTwilioWhatsAppAddress, isTwilioConfigured } from "../utils/twilioWhatsApp.js";

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
    venueElements: [
      {
        elementId: makeId("el"),
        type: "stage",
        label: "במה",
        x: 180,
        y: 20,
        width: 160,
        height: 48
      },
      {
        elementId: makeId("el"),
        type: "dance",
        label: "רחבת ריקודים",
        x: 140,
        y: 280,
        width: 200,
        height: 100
      }
    ]
  };
}

function guestForSeating(guest) {
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
    isSeated: Boolean(guest.seatingTableId),
    isEligible: isGuestEligibleForSeating(guest)
  };
}

router.get("/:userId/seating", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event");
    if (!user) return res.status(404).json({ message: "Client not found" });

    let layout = await SeatingLayout.findOne({ userId });
    if (!layout) {
      const seed = defaultLayout();
      layout = await SeatingLayout.create({ userId, ...seed });
    }

    const guests = await Guest.find({ userId }).sort({ fullName: 1 });
    const seatingGuests = guests.map(guestForSeating);
    const eligibleGuests = seatingGuests.filter((guest) => guest.isEligible);
    const analytics = buildSeatingAnalytics(guests, layout.tables);
    const warnings = buildSeatingWarnings(guests, layout.tables);

    return res.json({
      layout: {
        tables: layout.tables,
        venueElements: layout.venueElements
      },
      guests: seatingGuests,
      eligibleGuests,
      analytics,
      warnings,
      event: user.event
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
      { new: true, upsert: true, runValidators: true }
    );

    const guests = await Guest.find({ userId });
    return res.json({
      message: "פריסת האולם נשמרה",
      layout: { tables: layout.tables, venueElements: layout.venueElements },
      warnings: buildSeatingWarnings(guests, layout.tables)
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
      await Guest.findOneAndUpdate({ _id: guestId, userId }, { seatingTableId: "" });
    }

    for (const item of assignments) {
      if (!item?.guestId) continue;
      await Guest.findOneAndUpdate(
        { _id: item.guestId, userId },
        { seatingTableId: String(item.tableId || "").trim() }
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

router.post("/:userId/seating/auto-assign", async (req, res) => {
  try {
    const { userId } = req.params;
    const layout = await SeatingLayout.findOne({ userId });
    if (!layout?.tables?.length) {
      return res.status(400).json({ message: "יש להוסיף שולחנות לפני שיבוץ אוטומטי" });
    }

    const guests = await Guest.find({ userId });
    const assignments = autoAssignGuestsToTables(guests, layout.tables);

    for (const item of assignments) {
      await Guest.findOneAndUpdate({ _id: item.guestId, userId }, { seatingTableId: item.tableId });
    }

    const updatedGuests = await Guest.find({ userId });
    return res.json({
      message: `שובצו אוטומטית ${assignments.length} רשומות`,
      assignedCount: assignments.length,
      guests: updatedGuests.map(guestForSeating),
      warnings: buildSeatingWarnings(updatedGuests, layout.tables),
      analytics: buildSeatingAnalytics(updatedGuests, layout.tables)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Auto-assign failed" });
  }
});

router.post("/:userId/seating/send-table-messages", async (req, res) => {
  try {
    const { userId } = req.params;
    const paymentCode = String(req.body?.paymentCode || "").trim();

    if (!isTwilioConfigured()) {
      return res.status(503).json({ message: "שירות שליחת הודעות לא מוגדר בשרת" });
    }

    const layout = await SeatingLayout.findOne({ userId });
    const tableById = new Map((layout?.tables || []).map((table) => [table.tableId, table]));
    const guests = await Guest.find({
      userId,
      seatingTableId: { $ne: "" },
      status: "מגיע"
    });

    if (!guests.length) {
      return res.status(400).json({ message: "אין אורחים משובצים לשולחן עם סטטוס מגיע" });
    }

    let sent = 0;
    for (const guest of guests) {
      const table = tableById.get(guest.seatingTableId);
      const tableLabel = table?.label || guest.seatingTableId;
      const firstName = String(guest.fullName || "").trim().split(/\s+/)[0] || "אורח/ת";
      const body = `היי ${firstName}, שמחים שבאתם! מספר השולחן שלכם הוא ${tableLabel}. נתראה באירוע! — momoEVENT`;
      const to = toTwilioWhatsAppAddress(guest.phone);
      if (!to) continue;
      await sendTwilioWhatsAppMessage({ to, body });
      sent += 1;
    }

    return res.json({
      message: `נשלחו ${sent} הודעות עם מספר שולחן`,
      sentCount: sent,
      paymentCodeUsed: Boolean(paymentCode)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to send table messages" });
  }
});

export default router;
