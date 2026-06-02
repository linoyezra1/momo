import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";

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

    const guest = await Guest.create({
      userId: eventId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      attendeesCount: Number(attendeesCount || 1),
      status,
      source: "public"
    });

    return res.status(201).json({ message: "RSVP saved", guestId: guest._id });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save RSVP", error: error.message });
  }
});

export default router;
