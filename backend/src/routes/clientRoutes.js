import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import { normalizeDietaryRestrictions } from "../utils/usEvent.js";
import { formatStoredPhone } from "../utils/usPhone.js";

const router = express.Router();

const RSVP_STATUSES = ["Joyfully Accepts", "Regretfully Declines"];
const DIETARY_OPTIONS = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return email.includes("@") && email.includes(".");
}

function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber >= 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function normalizeStatus(raw) {
  const status = String(raw || "").trim();
  if (status === "Joyfully Accepts" || status === "accepts" || status === "yes") {
    return "Joyfully Accepts";
  }
  if (status === "Regretfully Declines" || status === "declines" || status === "no") {
    return "Regretfully Declines";
  }
  return "Joyfully Accepts";
}

function mapRowToGuest(row) {
  const fullName = String(
    row["Guest Name"] ?? row["Full Name"] ?? row["fullName"] ?? row["name"] ?? ""
  ).trim();
  const email = normalizeEmail(row["Email"] ?? row["email"] ?? "");
  const statusRaw = row["RSVP Status"] ?? row["status"] ?? row["Status"] ?? "";
  const amountRaw =
    row["Guests Attending"] ??
    row["Number of Guests"] ??
    row["attendeesCount"] ??
    row["guests"] ??
    row["count"];
  const attendeesCount = Math.max(0, parseAttendeesCount(amountRaw));
  const dietaryRaw = row["Dietary Restrictions"] ?? row["dietaryRestrictions"] ?? "";
  const dietaryRestrictions = Array.isArray(dietaryRaw)
    ? normalizeDietaryRestrictions(dietaryRaw)
    : normalizeDietaryRestrictions(
        String(dietaryRaw || "")
          .split(/[,;|]/)
          .map((item) => item.trim())
          .filter(Boolean)
      );
  const dietaryNotes = String(row["Dietary Notes"] ?? row["dietaryNotes"] ?? row["Notes"] ?? "").trim();
  const phone = formatStoredPhone(row["Phone"] ?? row["phone"] ?? row["Phone Number"] ?? "");

  return {
    fullName,
    email,
    phone,
    attendeesCount,
    status: normalizeStatus(statusRaw),
    dietaryRestrictions,
    dietaryNotes
  };
}

function toGuestDoc(userId, mapped) {
  return {
    userId,
    fullName: mapped.fullName,
    email: normalizeEmail(mapped.email),
    phone: formatStoredPhone(mapped.phone),
    attendeesCount: mapped.status === "Regretfully Declines" ? 0 : Math.max(1, mapped.attendeesCount || 1),
    status: mapped.status,
    dietaryRestrictions:
      mapped.status === "Joyfully Accepts" ? normalizeDietaryRestrictions(mapped.dietaryRestrictions) : [],
    dietaryNotes: mapped.status === "Joyfully Accepts" ? mapped.dietaryNotes : "",
    source: "excel"
  };
}

function guestSnapshot(guest) {
  return {
    fullName: guest.fullName,
    email: guest.email,
    phone: guest.phone || "",
    attendeesCount: guest.attendeesCount,
    status: guest.status,
    dietaryRestrictions: guest.dietaryRestrictions || [],
    dietaryNotes: guest.dietaryNotes || "",
    source: guest.source
  };
}

function hasDietaryAlert(restrictions) {
  const list = restrictions || [];
  return list.length > 0 && !list.every((item) => item === "None");
}

function buildSummary(guests) {
  return guests.reduce(
    (acc, guest) => {
      acc.totalInvited += 1;
      if (guest.status === "Joyfully Accepts") {
        acc.totalAttending += Math.max(0, Number(guest.attendeesCount || 0));
      } else if (guest.status === "Regretfully Declines") {
        acc.totalDeclined += 1;
      }
      if (hasDietaryAlert(guest.dietaryRestrictions)) {
        acc.dietaryAlerts += 1;
      }
      return acc;
    },
    { totalInvited: 0, totalAttending: 0, totalDeclined: 0, dietaryAlerts: 0 }
  );
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Email and password are required" });
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
      slug: user.slug,
      event: user.event
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/:userId/guests", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event username slug");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const guests = await Guest.find({ userId }).sort({ createdAt: -1 });
    const summary = buildSummary(guests);

    return res.json({
      summary,
      guests,
      event: user.event,
      username: user.username,
      slug: user.slug
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load guests", error: error.message });
  }
});

router.post("/:userId/guests/manual", async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, email, phone, attendeesCount, status, dietaryRestrictions, dietaryNotes } = req.body;

    if (!fullName || !email || !status) {
      return res.status(400).json({ message: "Guest name, email, and RSVP status are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    if (!RSVP_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid RSVP status" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const guestData = {
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: formatStoredPhone(phone),
      attendeesCount: status === "Regretfully Declines" ? 0 : Math.max(1, Number(attendeesCount || 1)),
      status,
      dietaryRestrictions:
        status === "Joyfully Accepts" ? normalizeDietaryRestrictions(dietaryRestrictions) : [],
      dietaryNotes: status === "Joyfully Accepts" ? String(dietaryNotes || "").trim() : "",
      source: "manual"
    };

    const existing = await Guest.findOne({ userId, email: normalizedEmail });
    if (existing) {
      if (existing.source === "form") {
        return res.status(409).json({
          message: "This guest already submitted an RSVP through your public invitation"
        });
      }
      const guest = await Guest.findByIdAndUpdate(existing._id, guestData, {
        new: true,
        runValidators: true
      });
      return res.json({ message: "Guest updated", guest });
    }

    const guest = await Guest.create({ userId, ...guestData });
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
      .filter((guest) => guest.fullName && guest.email && isValidEmail(guest.email));

    if (docs.length === 0) {
      return res.status(400).json({ message: "No valid guests to import" });
    }

    const emails = [...new Set(docs.map((doc) => doc.email))];
    const existingGuests = await Guest.find({ userId, email: { $in: emails } });
    const existingByEmail = new Map(existingGuests.map((guest) => [guest.email, guest]));

    const newGuests = [];
    const conflicts = [];

    for (const doc of docs) {
      const existing = existingByEmail.get(doc.email);
      if (existing) {
        conflicts.push({
          guestId: existing._id,
          email: doc.email,
          existing: guestSnapshot(existing),
          excel: {
            fullName: doc.fullName,
            phone: doc.phone || "",
            attendeesCount: doc.attendeesCount,
            status: doc.status,
            dietaryRestrictions: doc.dietaryRestrictions,
            dietaryNotes: doc.dietaryNotes
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
        row?.email && row?.fullName
          ? {
              userId,
              fullName: String(row.fullName).trim(),
              email: normalizeEmail(row.email),
              phone: formatStoredPhone(row.phone),
              attendeesCount:
                row.status === "Regretfully Declines" ? 0 : Math.max(1, Number(row.attendeesCount || 1)),
              status: RSVP_STATUSES.includes(row.status) ? row.status : "Joyfully Accepts",
              dietaryRestrictions: normalizeDietaryRestrictions(row.dietaryRestrictions),
              dietaryNotes: String(row.dietaryNotes || "").trim(),
              source: "excel"
            }
          : toGuestDoc(userId, mapRowToGuest(row));
      if (!doc.fullName || !doc.email || !isValidEmail(doc.email)) continue;
      const exists = await Guest.findOne({ userId, email: doc.email }).select("_id");
      if (exists) continue;
      await Guest.create(doc);
      insertedCount += 1;
    }

    let updatedCount = 0;
    const resolutionList = Array.isArray(resolutions) ? resolutions : [];

    for (const resolution of resolutionList) {
      if (resolution?.choice !== "use_excel") continue;
      const email = normalizeEmail(resolution.email);
      const excelRow = resolution.excel || resolution.excelData;
      if (!email || !excelRow) continue;

      const mapped = mapRowToGuest(excelRow);
      const doc = toGuestDoc(userId, mapped);
      const existing = await Guest.findOne({ userId, email });
      if (!existing) continue;

      await Guest.findByIdAndUpdate(
        existing._id,
        {
          fullName: doc.fullName,
          phone: doc.phone || "",
          attendeesCount: doc.attendeesCount,
          status: doc.status,
          dietaryRestrictions: doc.dietaryRestrictions,
          dietaryNotes: doc.dietaryNotes,
          source: existing.source === "form" ? "excel_and_form" : "excel"
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
    const { fullName, phone, attendeesCount, status, dietaryRestrictions, dietaryNotes } = req.body;

    const update = {};
    if (typeof fullName !== "undefined") {
      const trimmed = String(fullName).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Guest name is required" });
      }
      update.fullName = trimmed;
    }
    if (typeof attendeesCount !== "undefined") {
      update.attendeesCount = Math.max(0, Number(attendeesCount));
    }
    if (typeof status !== "undefined") {
      if (!RSVP_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid RSVP status" });
      }
      update.status = status;
      if (status === "Regretfully Declines") {
        update.attendeesCount = 0;
        update.dietaryRestrictions = [];
        update.dietaryNotes = "";
      }
    }
    if (typeof dietaryRestrictions !== "undefined") {
      update.dietaryRestrictions = normalizeDietaryRestrictions(dietaryRestrictions);
    }
    if (typeof dietaryNotes !== "undefined") {
      update.dietaryNotes = String(dietaryNotes || "").trim();
    }
    if (typeof phone !== "undefined") {
      update.phone = formatStoredPhone(phone);
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

export { DIETARY_OPTIONS, RSVP_STATUSES };
export default router;
