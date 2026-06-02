import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";

const router = express.Router();

function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function normalizePhone(phone) {
  let value = String(phone ?? "").trim();
  if (typeof phone === "number" && Number.isFinite(phone)) {
    value = String(Math.trunc(phone));
  }
  if (!value) return "";
  value = value.replace(/[^\d]/g, "");
  if (value.startsWith("5") && value.length === 9) {
    value = `0${value}`;
  }
  return value;
}

function mapRowToGuest(row) {
  const fullName = String(row["שם מלא"] ?? row["fullName"] ?? row["name"] ?? "").trim();
  const phone = normalizePhone(row["טלפון"] ?? row["phone"] ?? "");
  const amountRaw =
    row["כמות"] ??
    row["כמות מגיעים"] ??
    row["כמות אנשים"] ??
    row["מוזמנים"] ??
    row["amount"] ??
    row["count"] ??
    row["attendeesCount"];
  const attendeesCount = Math.max(1, parseAttendeesCount(amountRaw));
  const statusRaw = String(row["סטטוס"] ?? row["status"] ?? row["סטטוס הגעה"] ?? "").trim();
  let status = "לא ידוע";
  if (statusRaw === "מגיע" || statusRaw === "לא מגיע" || statusRaw === "אולי") {
    status = statusRaw;
  }
  return { fullName, phone, attendeesCount, status };
}

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
        const count = Math.max(0, Number(guest.attendeesCount || 0));
        acc.totalInvited += count;
        if (guest.status === "מגיע") {
          acc.totalComing += count;
        } else if (guest.status === "לא מגיע") {
          acc.totalNotComing += count;
        } else {
          acc.totalMaybe += count;
        }
        return acc;
      },
      { totalInvited: 0, totalComing: 0, totalNotComing: 0, totalMaybe: 0 }
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
      phone: normalizePhone(phone),
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
      .map((row) => {
        const mapped = mapRowToGuest(row);
        return {
          userId,
          fullName: mapped.fullName,
          phone: normalizePhone(mapped.phone),
          attendeesCount: mapped.attendeesCount,
          status: mapped.status,
          source: "excel"
        };
      })
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
      if (!["מגיע", "לא מגיע", "אולי", "לא ידוע"].includes(status)) {
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
