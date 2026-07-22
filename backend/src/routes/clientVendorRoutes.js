import express from "express";
import User from "../models/User.js";
import Vendor, { VENDOR_CATEGORIES } from "../models/Vendor.js";
import EventVendor, { EVENT_VENDOR_STATUSES } from "../models/EventVendor.js";

const router = express.Router();

function sanitizeVendorPayload(body = {}) {
  const category = String(body.category || "אחר").trim();
  return {
    name: String(body.name || "").trim(),
    category: VENDOR_CATEGORIES.includes(category) ? category : "אחר",
    contactName: String(body.contactName || "").trim(),
    phone: String(body.phone || "").trim(),
    email: String(body.email || "").trim(),
    notes: String(body.notes || "").trim()
  };
}

function sanitizeEventVendorPayload(body = {}) {
  const status = String(body.status || "OFFER_SENT").trim();
  return {
    quoteAmount: Math.max(0, Number(body.quoteAmount) || 0),
    status: EVENT_VENDOR_STATUSES.includes(status) ? status : "OFFER_SENT",
    eventNotes: String(body.eventNotes || "").trim(),
    attachmentUrl: String(body.attachmentUrl || "").trim()
  };
}

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

function serializeEventVendor(doc) {
  const vendor = doc.vendorId && typeof doc.vendorId === "object" ? doc.vendorId : null;
  return {
    id: String(doc._id),
    eventId: String(doc.eventId?._id || doc.eventId),
    vendorId: String(vendor?._id || doc.vendorId),
    quoteAmount: Number(doc.quoteAmount || 0),
    status: doc.status,
    eventNotes: doc.eventNotes || "",
    attachmentUrl: doc.attachmentUrl || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    vendor: vendor ? serializeVendor(vendor) : null
  };
}

function buildSummary(entries) {
  return entries.reduce(
    (acc, item) => {
      const amount = Number(item.quoteAmount || 0);
      acc.totalProposed += amount;
      if (item.status === "BOOKED") acc.totalBooked += amount;
      return acc;
    },
    { totalProposed: 0, totalBooked: 0 }
  );
}

function buildEventLabel(event) {
  if (!event) return "אירוע";
  if (event.eventType === "חתונה") {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || "חתונה";
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || "בת מצווה";
  }
  return event.eventNames || "אירוע";
}

router.get("/:userId/event-vendors/catalog", async (req, res) => {
  try {
    const count = await Vendor.countDocuments();
    if (count === 0) {
      await Vendor.insertMany([
        {
          name: "גן האירועים נוף הגליל",
          category: "אולם / גן אירועים",
          contactName: "רונית כהן",
          phone: "0521234567",
          email: "nof@example.com",
          notes: "חבילת אולם + קייטרינג בסיסי"
        },
        {
          name: "צלמים — סטודיו זהב",
          category: "צלם",
          contactName: "יוסי לוי",
          phone: "0547654321",
          email: "goldphoto@example.com",
          notes: "חבילת צילום יום מלא"
        },
        {
          name: "DJ אורן",
          category: "דיג'יי / מוזיקה",
          contactName: "אורן מזרחי",
          phone: "0509876543",
          email: "",
          notes: "כולל תאורה בסיסית"
        }
      ]);
    }
    const vendors = await Vendor.find({}).sort({ name: 1 });
    return res.json({
      vendors: vendors.map(serializeVendor),
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
    const user = await User.findById(userId).select("_id event username");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const entries = await EventVendor.find({ eventId: userId })
      .populate("vendorId")
      .sort({ updatedAt: -1 });

    const eventVendors = entries.map(serializeEventVendor);
    return res.json({
      eventId: String(user._id),
      eventLabel: buildEventLabel(user.event),
      eventVendors,
      summary: buildSummary(eventVendors),
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
    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    let vendorId = String(req.body?.vendorId || "").trim();
    const createVendor = req.body?.createVendor;

    if (!vendorId && createVendor) {
      const vendorPayload = sanitizeVendorPayload(createVendor);
      if (!vendorPayload.name) {
        return res.status(400).json({ message: "שם הספק הוא שדה חובה" });
      }
      const created = await Vendor.create(vendorPayload);
      vendorId = String(created._id);
    }

    if (!vendorId) {
      return res.status(400).json({ message: "יש לבחור ספק או ליצור ספק חדש" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: "הספק לא נמצא" });

    const existing = await EventVendor.findOne({ eventId: userId, vendorId });
    if (existing) {
      return res.status(409).json({ message: "הספק כבר משויך לאירוע זה" });
    }

    const payload = sanitizeEventVendorPayload(req.body);
    const entry = await EventVendor.create({
      eventId: userId,
      vendorId,
      ...payload
    });
    await entry.populate("vendorId");

    return res.status(201).json({ eventVendor: serializeEventVendor(entry) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "הספק כבר משויך לאירוע זה" });
    }
    return res.status(500).json({ message: error.message || "שיוך ספק לאירוע נכשל" });
  }
});

router.patch("/:userId/event-vendors/:eventVendorId", async (req, res) => {
  try {
    const { userId, eventVendorId } = req.params;
    const payload = sanitizeEventVendorPayload(req.body);
    const entry = await EventVendor.findOneAndUpdate(
      { _id: eventVendorId, eventId: userId },
      payload,
      { new: true, runValidators: true }
    ).populate("vendorId");

    if (!entry) return res.status(404).json({ message: "שיוך הספק לא נמצא" });
    return res.json({ eventVendor: serializeEventVendor(entry) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "עדכון שיוך הספק נכשל" });
  }
});

router.delete("/:userId/event-vendors/:eventVendorId", async (req, res) => {
  try {
    const { userId, eventVendorId } = req.params;
    const entry = await EventVendor.findOneAndDelete({ _id: eventVendorId, eventId: userId });
    if (!entry) return res.status(404).json({ message: "שיוך הספק לא נמצא" });
    return res.json({ message: "הספק הוסר מהאירוע", id: String(entry._id) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "הסרת הספק מהאירוע נכשלה" });
  }
});

export default router;
