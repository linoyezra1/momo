import express from "express";
import User from "../models/User.js";
import Vendor, { VENDOR_CATEGORIES, resolveVendorCategory } from "../models/Vendor.js";
import EventVendor, { EVENT_VENDOR_STATUSES } from "../models/EventVendor.js";
import {
  coupleCanManageVendors,
  serializeCoupleEventVendor,
  sanitizeCoupleEventVendorPayload
} from "../utils/coupleVendors.js";
import { getEventTypeNoun, isCoupleEventType } from "../utils/eventTypeWording.js";

const router = express.Router();

function serializeVendor(vendor) {
  return {
    id: String(vendor._id),
    name: vendor.name,
    category: vendor.category,
    contactName: vendor.contactName || "",
    phone: vendor.phone || "",
    email: vendor.email || "",
    notes: vendor.notes || "",
    createdAt: vendor.createdAt
  };
}

function buildEventLabel(event) {
  if (!event) return "אירוע";
  if (isCoupleEventType(event.eventType)) {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || getEventTypeNoun(event.eventType);
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || "בת מצווה";
  }
  return event.eventNames || "אירוע";
}

async function loadCoupleForVendors(userId) {
  const user = await User.findById(userId).select("_id event username managedBy");
  if (!user) return { error: { status: 404, message: "האירוע לא נמצא" } };
  if (!coupleCanManageVendors(user)) {
    return {
      error: {
        status: 403,
        message: "ניהול ספקים ותקציב מטופל על ידי מנהל האירוע ששויך לחשבון זה"
      }
    };
  }
  return { user };
}

function sanitizeVendorPayload(body = {}) {
  return {
    name: String(body.name || "").trim(),
    category: resolveVendorCategory(body),
    contactName: String(body.contactName || "").trim(),
    phone: String(body.phone || "").trim(),
    email: String(body.email || "").trim(),
    notes: String(body.notes || "").trim()
  };
}

router.get("/:userId/event-vendors/catalog", async (req, res) => {
  try {
    const { userId } = req.params;
    const loaded = await loadCoupleForVendors(userId);
    if (loaded.error) return res.status(loaded.error.status).json({ message: loaded.error.message });

    // Couples must not browse the shared vendor catalog — create-only.
    return res.status(403).json({
      message: "אין גישה למאגר הספקים. ניתן להוסיף ספק חדש בלבד",
      vendors: [],
      categories: VENDOR_CATEGORIES,
      statuses: EVENT_VENDOR_STATUSES
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת מאגר הספקים נכשלה" });
  }
});

router.get("/:userId/event-vendors", async (req, res) => {
  try {
    const { userId } = req.params;
    const loaded = await loadCoupleForVendors(userId);
    if (loaded.error) return res.status(loaded.error.status).json({ message: loaded.error.message });

    const entries = await EventVendor.find({ eventId: userId })
      .populate("vendorId")
      .sort({ updatedAt: -1 });

    const eventVendors = entries.map((doc) => serializeCoupleEventVendor(doc, serializeVendor));
    const totalAgreed = eventVendors.reduce((sum, item) => sum + (Number(item.agreedPrice) || 0), 0);

    return res.json({
      eventId: String(loaded.user._id),
      eventLabel: buildEventLabel(loaded.user.event),
      canManageVendors: true,
      viewMode: "couple",
      eventVendors,
      summary: {
        totalAgreed,
        vendorCount: eventVendors.length,
        bookedCount: eventVendors.filter((item) => item.status === "BOOKED").length
      },
      categories: VENDOR_CATEGORIES,
      statuses: EVENT_VENDOR_STATUSES
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת ספקי האירוע נכשלה" });
  }
});

router.post("/:userId/event-vendors", async (req, res) => {
  try {
    const { userId } = req.params;
    const loaded = await loadCoupleForVendors(userId);
    if (loaded.error) return res.status(loaded.error.status).json({ message: loaded.error.message });

    if (String(req.body?.vendorId || "").trim()) {
      return res.status(403).json({
        message: "אין גישה למאגר הספקים. יש ליצור ספק חדש בלבד"
      });
    }

    const createVendor = req.body?.createVendor;
    if (!createVendor || typeof createVendor !== "object") {
      return res.status(400).json({ message: "יש ליצור ספק חדש" });
    }

    const vendorPayload = sanitizeVendorPayload(createVendor);
    if (!vendorPayload.name) {
      return res.status(400).json({ message: "שם הספק הוא שדה חובה" });
    }

    const finance = sanitizeCoupleEventVendorPayload(req.body);
    const vendor = await Vendor.create(vendorPayload);
    const vendorId = String(vendor._id);

    const existing = await EventVendor.findOne({ eventId: userId, vendorId });
    if (existing) {
      return res.status(409).json({ message: "הספק כבר משויך לאירוע זה" });
    }

    const entry = await EventVendor.create({
      eventId: userId,
      vendorId,
      ...finance
    });
    await entry.populate("vendorId");

    return res.status(201).json({
      eventVendor: serializeCoupleEventVendor(entry, serializeVendor)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "הוספת ספק לאירוע נכשלה" });
  }
});

router.patch("/:userId/event-vendors/:eventVendorId", async (req, res) => {
  try {
    const { userId, eventVendorId } = req.params;
    const loaded = await loadCoupleForVendors(userId);
    if (loaded.error) return res.status(loaded.error.status).json({ message: loaded.error.message });

    const finance = sanitizeCoupleEventVendorPayload(req.body);
    const entry = await EventVendor.findOneAndUpdate(
      { _id: eventVendorId, eventId: userId },
      { $set: finance },
      { new: true }
    ).populate("vendorId");

    if (!entry) return res.status(404).json({ message: "שיוך הספק לא נמצא" });

    return res.json({
      eventVendor: serializeCoupleEventVendor(entry, serializeVendor)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "עדכון הספק נכשל" });
  }
});

router.delete("/:userId/event-vendors/:eventVendorId", async (req, res) => {
  try {
    const { userId, eventVendorId } = req.params;
    const loaded = await loadCoupleForVendors(userId);
    if (loaded.error) return res.status(loaded.error.status).json({ message: loaded.error.message });

    const entry = await EventVendor.findOneAndDelete({ _id: eventVendorId, eventId: userId });
    if (!entry) return res.status(404).json({ message: "שיוך הספק לא נמצא" });

    return res.json({ message: "הספק הוסר מהאירוע", id: String(entry._id) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "הסרת הספק נכשלה" });
  }
});

export default router;
