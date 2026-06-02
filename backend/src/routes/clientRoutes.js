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

    return res.json({ summary, guests });
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

export default router;
