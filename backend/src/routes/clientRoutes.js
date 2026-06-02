import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      userId: user._id,
      username: user.username,
      event: user.event
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/:userId/guests", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const guests = await Guest.find({ userId }).sort({ createdAt: -1 });

    const summary = guests.reduce(
      (acc, guest) => {
        if (guest.status === "מגיע") {
          acc.totalComing += guest.attendeesCount;
        } else if (guest.status === "לא מגיע") {
          acc.totalNotComing += 1;
        } else if (guest.status === "אולי") {
          acc.totalMaybe += 1;
        }
        return acc;
      },
      { totalComing: 0, totalNotComing: 0, totalMaybe: 0 }
    );

    return res.json({ summary, guests, event: user.event, username: user.username });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load guests", error: error.message });
  }
});

router.post("/:userId/guests/manual", async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, attendeesCount, status } = req.body;

    if (!fullName || !phone || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const guest = await Guest.create({
      userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      attendeesCount: Number(attendeesCount || 1),
      status,
      source: "manual"
    });

    return res.status(201).json({ message: "Guest added", guest });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add guest", error: error.message });
  }
});

router.post("/:userId/guests/import", async (req, res) => {
  try {
    const { userId } = req.params;
    const { guests } = req.body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ message: "Guests array is required" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const docs = guests
      .map((guest) => ({
        userId,
        fullName: String(guest?.fullName || "").trim(),
        phone: String(guest?.phone || "").trim(),
        attendeesCount: Math.max(0, Number(guest?.attendeesCount || 1)),
        status: ["מגיע", "לא מגיע", "אולי"].includes(guest?.status) ? guest.status : "אולי",
        source: "excel"
      }))
      .filter((guest) => guest.fullName && guest.phone);

    if (docs.length === 0) {
      return res.status(400).json({ message: "No valid guests to import" });
    }

    const inserted = await Guest.insertMany(docs, { ordered: false });
    return res.status(201).json({ message: "Guests imported", insertedCount: inserted.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to import guests", error: error.message });
  }
});

router.patch("/:userId/guests/:guestId", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const { attendeesCount, status } = req.body;

    const update = {};
    if (typeof attendeesCount !== "undefined") {
      update.attendeesCount = Math.max(0, Number(attendeesCount));
    }
    if (typeof status !== "undefined") {
      if (!["מגיע", "לא מגיע", "אולי"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      update.status = status;
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const guest = await Guest.findOneAndUpdate({ _id: guestId, userId }, update, {
      new: true,
      runValidators: true
    });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    return res.json({ message: "Guest updated", guest });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update guest", error: error.message });
  }
});

export default router;
