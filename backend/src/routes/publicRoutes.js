import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import {
  normalizeUsRsvpPayload,
  toPublicEventPayload,
  validateUsRsvpPayload
} from "../utils/usEvent.js";

const router = express.Router();

router.get("/event/by-slug/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const user = await User.findOne({ slug }).select("slug event");

    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(toPublicEventPayload(user));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch event", error: error.message });
  }
});

router.get("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(eventId).select("slug event");

    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(toPublicEventPayload(user));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch event", error: error.message });
  }
});

async function saveUsRsvp(userId, payload) {
  const existing = await Guest.findOne({ userId, email: payload.email });

  const guestData = {
    fullName: payload.fullName,
    email: payload.email,
    attendeesCount: payload.status === "Regretfully Declines" ? 0 : payload.attendeesCount,
    status: payload.status,
    dietaryRestrictions: payload.status === "Joyfully Accepts" ? payload.dietaryRestrictions : [],
    dietaryNotes: payload.status === "Joyfully Accepts" ? payload.dietaryNotes : "",
    source: "form"
  };

  if (existing) {
    const updated = await Guest.findByIdAndUpdate(existing._id, guestData, {
      new: true,
      runValidators: true
    });
    return { guestId: updated._id, updated: true };
  }

  const guest = await Guest.create({
    userId,
    ...guestData
  });
  return { guestId: guest._id, updated: false };
}

router.post("/event/by-slug/:slug/rsvp", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const user = await User.findOne({ slug }).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    const payload = normalizeUsRsvpPayload(req.body);
    const validationError = validateUsRsvpPayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const result = await saveUsRsvp(user._id, payload);
    return res.status(result.updated ? 200 : 201).json({
      message: result.updated ? "RSVP updated" : "RSVP saved",
      ...result
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save RSVP" });
  }
});

router.post("/event/:eventId/rsvp", async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(eventId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    const payload = normalizeUsRsvpPayload(req.body);
    const validationError = validateUsRsvpPayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const result = await saveUsRsvp(user._id, payload);
    return res.status(result.updated ? 200 : 201).json({
      message: result.updated ? "RSVP updated" : "RSVP saved",
      ...result
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save RSVP" });
  }
});

export default router;
