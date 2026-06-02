import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import { normalizePhone, resolveSourceAfterSelfRsvp } from "../utils/guestPhone.js";

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
      const updated = await Guest.findByIdAndUpdate(
        existing._id,
        {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          attendeesCount: Math.max(0, Number(attendeesCount || 1)),
          status,
          source: resolveSourceAfterSelfRsvp(existing)
        },
        { new: true, runValidators: true }
      );
      return res.json({ message: "RSVP updated", guestId: updated._id, updated: true });
    }

    const guest = await Guest.create({
      userId: eventId,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      attendeesCount: Math.max(0, Number(attendeesCount || 1)),
      status,
      source: "form"
    });

    return res.status(201).json({ message: "RSVP saved", guestId: guest._id, updated: false });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save RSVP" });
  }
});

export default router;
