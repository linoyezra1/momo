import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import { normalizePhone, isSelfConfirmedSource } from "../utils/guestPhone.js";

const router = express.Router();

function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
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
  return { fullName, phone, attendeesCount, status, giftAmount: 0 };
}

function toGuestDoc(userId, mapped) {
  return {
    userId,
    fullName: mapped.fullName,
    phone: normalizePhone(mapped.phone),
    attendeesCount: mapped.attendeesCount,
    giftAmount: Math.max(0, Number(mapped.giftAmount || 0)),
    status: mapped.status,
    source: "excel"
  };
}

function guestSnapshot(guest) {
  return {
    fullName: guest.fullName,
    attendeesCount: guest.attendeesCount,
    giftAmount: guest.giftAmount || 0,
    status: guest.status,
    source: guest.source
  };
}

function resolveSourceAfterExcelOverwrite(existingSource) {
  if (isSelfConfirmedSource(existingSource)) {
    return "excel_and_form";
  }
  return "excel";
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
    const { fullName, phone, attendeesCount, status, giftAmount } = req.body;

    if (!fullName || !phone || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const existing = await Guest.findOne({ userId, phone: normalizedPhone });
    if (existing) {
      if (isSelfConfirmedSource(existing.source)) {
        return res.status(409).json({
          message: "מוזמן עם מספר טלפון זה כבר אישר הגעה בעצמו במערכת"
        });
      }
      const guest = await Guest.findByIdAndUpdate(
        existing._id,
        {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          attendeesCount: Number(attendeesCount || 1),
          giftAmount: Math.max(0, Number(giftAmount || 0)),
          status,
          source: "manual"
        },
        { new: true, runValidators: true }
      );
      return res.json({ message: "Guest updated", guest });
    }

    const guest = await Guest.create({
      userId,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      attendeesCount: Number(attendeesCount || 1),
      giftAmount: Math.max(0, Number(giftAmount || 0)),
      status,
      source: "manual"
    });

    return res.status(201).json({ message: "Guest added", guest });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add guest" });
  }
});

router.post("/:userId/guests/import/precheck", async (req, res) => {
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
      .map((row) => toGuestDoc(userId, mapRowToGuest(row)))
      .filter((guest) => guest.fullName && guest.phone);

    if (docs.length === 0) {
      return res.status(400).json({ message: "No valid guests to import" });
    }

    const phones = [...new Set(docs.map((doc) => doc.phone))];
    const existingGuests = await Guest.find({ userId, phone: { $in: phones } });
    const existingByPhone = new Map(existingGuests.map((guest) => [guest.phone, guest]));

    const newGuests = [];
    const conflicts = [];

    for (const doc of docs) {
      const existing = existingByPhone.get(doc.phone);
      if (existing) {
        conflicts.push({
          guestId: existing._id,
          phone: doc.phone,
          existing: guestSnapshot(existing),
          excel: {
            fullName: doc.fullName,
            attendeesCount: doc.attendeesCount,
            status: doc.status
          }
        });
      } else {
        newGuests.push(doc);
      }
    }

    return res.json({
      message: "Precheck completed",
      totalRows: docs.length,
      conflictCount: conflicts.length,
      newCount: newGuests.length,
      conflicts,
      newGuests
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to precheck import" });
  }
});

router.post("/:userId/guests/import", async (req, res) => {
  try {
    const { userId } = req.params;
    const { newGuests, resolutions } = req.body;

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    let insertedCount = 0;
    const guestsToInsert = Array.isArray(newGuests) ? newGuests : [];

    for (const row of guestsToInsert) {
      const doc =
        row?.phone && row?.fullName
          ? {
              userId,
              fullName: String(row.fullName).trim(),
              phone: normalizePhone(row.phone),
              attendeesCount: Math.max(1, Number(row.attendeesCount || 1)),
              giftAmount: Math.max(0, Number(row.giftAmount || 0)),
              status: row.status || "לא ידוע",
              source: "excel"
            }
          : toGuestDoc(userId, mapRowToGuest(row));
      if (!doc.fullName || !doc.phone) continue;
      const exists = await Guest.findOne({ userId, phone: doc.phone }).select("_id");
      if (exists) continue;
      await Guest.create(doc);
      insertedCount += 1;
    }

    let updatedCount = 0;
    const resolutionList = Array.isArray(resolutions) ? resolutions : [];

    for (const resolution of resolutionList) {
      if (resolution?.choice !== "use_excel") continue;
      const phone = normalizePhone(resolution.phone);
      const excelRow = resolution.excel || resolution.excelData;
      if (!phone || !excelRow) continue;

      const mapped = mapRowToGuest(excelRow);
      const doc = toGuestDoc(userId, mapped);
      const existing = await Guest.findOne({ userId, phone });
      if (!existing) continue;

      await Guest.findByIdAndUpdate(
        existing._id,
        {
          fullName: doc.fullName,
          attendeesCount: doc.attendeesCount,
          giftAmount: Math.max(0, Number(doc.giftAmount || 0)),
          status: doc.status,
          source: resolveSourceAfterExcelOverwrite(existing.source)
        },
        { runValidators: true }
      );
      updatedCount += 1;
    }

    return res.status(201).json({
      message: "Guests import saved",
      insertedCount,
      updatedCount
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to import guests" });
  }
});

router.patch("/:userId/guests/:guestId", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const { fullName, attendeesCount, status, giftAmount } = req.body;

    const update = {};
    if (typeof fullName !== "undefined") {
      const trimmed = String(fullName).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "שם מלא הוא שדה חובה" });
      }
      update.fullName = trimmed;
    }
    if (typeof attendeesCount !== "undefined") {
      update.attendeesCount = Math.max(0, Number(attendeesCount));
    }
    if (typeof giftAmount !== "undefined") {
      update.giftAmount = Math.max(0, Number(giftAmount));
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
