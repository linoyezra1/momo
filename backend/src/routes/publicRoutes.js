import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import Lead from "../models/Lead.js";
import { normalizePhone, resolveSourceAfterSelfRsvp } from "../utils/guestPhone.js";
import { recordGuestSelfUpdate } from "../services/guestAuditService.js";
import {
  STATUS_HISTORY_LABELS,
  STATUS_HISTORY_SOURCES,
  initialStatusHistoryEntry,
  statusHistoryPushEntry
} from "../utils/guestStatusHistory.js";

const router = express.Router();

router.get("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(eventId).select("event");

    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json({ eventId, event: user.event });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch event", error: error.message });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const phoneRaw = String(req.body?.phone || "").trim();
    const eventDate = String(req.body?.eventDate || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!fullName) {
      return res.status(400).json({ message: "שם מלא הוא שדה חובה" });
    }
    if (!phoneRaw) {
      return res.status(400).json({ message: "מספר טלפון הוא שדה חובה" });
    }

    const normalizedPhone = normalizePhone(phoneRaw) || phoneRaw.replace(/\s+/g, "");
    if (normalizedPhone.length < 9) {
      return res.status(400).json({ message: "מספר טלפון לא תקין" });
    }

    const lead = await Lead.create({
      fullName,
      phone: normalizedPhone,
      eventDate,
      message,
      source: "landing"
    });

    return res.status(201).json({
      message: "הודעתכם התקבלה בהצלחה",
      leadId: lead._id
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "שמירת הפנייה נכשלה" });
  }
});

router.post("/event/:eventId/rsvp", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fullName, phone, attendeesCount, status } = req.body;

    if (!fullName || !phone || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findById(eventId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const existing = await Guest.findOne({ userId: eventId, phone: normalizedPhone });

    if (existing) {
      const before = {
        status: existing.status,
        attendeesCount: existing.attendeesCount
      };
      const updateOps = {
        $set: {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          attendeesCount: Math.max(0, Number(attendeesCount || 1)),
          status,
          confirmationMethod: "web",
          source: resolveSourceAfterSelfRsvp(existing)
        }
      };
      const historyEntry = statusHistoryPushEntry({
        previousStatus: existing.status,
        nextStatus: status,
        updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.PUBLIC_LINK],
        source: STATUS_HISTORY_SOURCES.PUBLIC_LINK
      });
      if (historyEntry) {
        updateOps.$push = { statusHistory: historyEntry };
      }
      const updated = await Guest.findByIdAndUpdate(existing._id, updateOps, {
        new: true,
        runValidators: true
      });
      await recordGuestSelfUpdate({
        guest: updated,
        before,
        channel: "web"
      });
      return res.json({ message: "RSVP updated", guestId: updated._id, updated: true });
    }

    const guest = await Guest.create({
      userId: eventId,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      attendeesCount: Math.max(0, Number(attendeesCount || 1)),
      status,
      confirmationMethod: "web",
      source: "form",
      statusHistory: [
        initialStatusHistoryEntry({
          status,
          updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.PUBLIC_LINK],
          source: STATUS_HISTORY_SOURCES.PUBLIC_LINK
        })
      ]
    });

    return res.status(201).json({ message: "RSVP saved", guestId: guest._id, updated: false });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save RSVP" });
  }
});

export default router;
