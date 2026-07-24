import express from "express";
import User from "../models/User.js";
import Vendor, { VENDOR_CATEGORIES, resolveVendorCategory } from "../models/Vendor.js";
import EventVendor, { EVENT_VENDOR_STATUSES } from "../models/EventVendor.js";
import { requireEventManager } from "../middleware/eventManagerAuth.js";
import {
  buildBudgetWarning,
  buildVendorAmountSummary,
  sanitizeEventVendorFinancePayload,
  sanitizeFinancePayload,
  serializeEventVendorFinance,
  serializeFinance
} from "../utils/eventFinance.js";

const router = express.Router();

const SAMPLE_VENDORS = [
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
  },
  {
    name: "פרחי לילי",
    category: "פרחים / עיצוב",
    contactName: "לילי אברהם",
    phone: "0532223344",
    email: "lili@example.com",
    notes: ""
  },
  {
    name: "איפור נועה",
    category: "איפור ושיער",
    contactName: "נועה שמש",
    phone: "0581112233",
    email: "",
    notes: "ניסיון בחתונות יוקרה"
  }
];

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

function sanitizeEventVendorPayload(body = {}) {
  const payload = sanitizeEventVendorFinancePayload(body);
  if (!EVENT_VENDOR_STATUSES.includes(payload.status)) {
    payload.status = "NEGOTIATING";
  }
  return payload;
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

async function ensureSampleVendors() {
  const count = await Vendor.countDocuments();
  if (count > 0) return;
  await Vendor.insertMany(SAMPLE_VENDORS);
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
  return serializeEventVendorFinance(doc, serializeVendor);
}

function buildSummary(entries) {
  return buildVendorAmountSummary(entries);
}

/* ——— Global vendor directory (manager only) ——— */

router.get("/vendors/meta", requireEventManager, (_req, res) => {
  return res.json({
    categories: VENDOR_CATEGORIES,
    statuses: EVENT_VENDOR_STATUSES
  });
});

router.get("/vendors", requireEventManager, async (req, res) => {
  try {
    await ensureSampleVendors();
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const filter = {};
    if (category && category !== "all") {
      filter.category = category;
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { contactName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ];
    }

    const vendors = await Vendor.find(filter).sort({ name: 1 });
    return res.json({
      vendors: vendors.map(serializeVendor),
      categories: VENDOR_CATEGORIES
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת מאגר הספקים נכשלה" });
  }
});

router.post("/vendors", requireEventManager, async (req, res) => {
  try {
    const payload = sanitizeVendorPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: "שם הספק הוא שדה חובה" });
    }
    const vendor = await Vendor.create(payload);
    return res.status(201).json({ vendor: serializeVendor(vendor) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "יצירת ספק נכשלה" });
  }
});

router.get("/vendors/:vendorId", requireEventManager, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) return res.status(404).json({ message: "הספק לא נמצא" });

    const quotes = await EventVendor.find({ vendorId: vendor._id })
      .populate("eventId", "username event")
      .sort({ updatedAt: -1 });

    const history = quotes.map((item) => {
      const user = item.eventId;
      const vendorQuoteAmount = Math.max(0, Number(item.vendorQuoteAmount ?? item.quoteAmount) || 0);
      const couplePrice = Math.max(0, Number(item.couplePrice) || 0);
      return {
        id: String(item._id),
        eventId: String(user?._id || item.eventId),
        eventLabel: buildEventLabel(user?.event),
        username: user?.username || "",
        quoteAmount: vendorQuoteAmount,
        vendorQuoteAmount,
        couplePrice,
        profit: couplePrice - vendorQuoteAmount,
        status: item.status,
        eventNotes: item.eventNotes || "",
        attachmentUrl: item.attachmentUrl || "",
        updatedAt: item.updatedAt
      };
    });

    return res.json({
      vendor: serializeVendor(vendor),
      history,
      summary: buildSummary(history)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת פרטי הספק נכשלה" });
  }
});

router.patch("/vendors/:vendorId", requireEventManager, async (req, res) => {
  try {
    const payload = sanitizeVendorPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: "שם הספק הוא שדה חובה" });
    }
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId, payload, {
      new: true,
      runValidators: true
    });
    if (!vendor) return res.status(404).json({ message: "הספק לא נמצא" });
    return res.json({ vendor: serializeVendor(vendor) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "עדכון ספק נכשל" });
  }
});

router.delete("/vendors/:vendorId", requireEventManager, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.vendorId);
    if (!vendor) return res.status(404).json({ message: "הספק לא נמצא" });
    await EventVendor.deleteMany({ vendorId: vendor._id });
    return res.json({ message: "הספק נמחק", vendorId: String(vendor._id) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "מחיקת ספק נכשלה" });
  }
});

/* ——— Event-scoped vendors + finance (manager only) ——— */

router.get("/clients/:userId/event-vendors", requireEventManager, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id event username finance");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const entries = await EventVendor.find({ eventId: userId })
      .populate("vendorId")
      .sort({ updatedAt: -1 });

    const eventVendors = entries.map(serializeEventVendor);
    const summary = buildSummary(eventVendors);
    const finance = serializeFinance(user.finance);
    return res.json({
      eventId: String(user._id),
      eventLabel: buildEventLabel(user.event),
      eventVendors,
      summary,
      finance,
      budgetWarning: buildBudgetWarning({
        totalRevenue: summary.totalRevenue,
        targetCoupleBudget: finance.targetCoupleBudget
      }),
      categories: VENDOR_CATEGORIES,
      statuses: EVENT_VENDOR_STATUSES
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת ספקי האירוע נכשלה" });
  }
});

router.post("/clients/:userId/event-vendors", requireEventManager, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id finance");
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

    const allEntries = await EventVendor.find({ eventId: userId });
    const projected = allEntries.map(serializeEventVendor);
    const summary = buildSummary(projected);
    const finance = serializeFinance(user.finance);

    return res.status(201).json({
      eventVendor: serializeEventVendor(entry),
      summary,
      finance,
      budgetWarning: buildBudgetWarning({
        totalRevenue: summary.totalRevenue,
        targetCoupleBudget: finance.targetCoupleBudget
      })
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "הספק כבר משויך לאירוע זה" });
    }
    return res.status(500).json({ message: error.message || "שיוך ספק לאירוע נכשל" });
  }
});

router.patch("/clients/:userId/event-vendors/:eventVendorId", requireEventManager, async (req, res) => {
  try {
    const { userId, eventVendorId } = req.params;
    const user = await User.findById(userId).select("_id finance");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const payload = sanitizeEventVendorPayload(req.body);
    const entry = await EventVendor.findOneAndUpdate(
      { _id: eventVendorId, eventId: userId },
      payload,
      { new: true, runValidators: true }
    ).populate("vendorId");

    if (!entry) return res.status(404).json({ message: "שיוך הספק לא נמצא" });

    const allEntries = await EventVendor.find({ eventId: userId });
    const projected = allEntries.map(serializeEventVendor);
    const summary = buildSummary(projected);
    const finance = serializeFinance(user.finance);

    return res.json({
      eventVendor: serializeEventVendor(entry),
      summary,
      finance,
      budgetWarning: buildBudgetWarning({
        totalRevenue: summary.totalRevenue,
        targetCoupleBudget: finance.targetCoupleBudget
      })
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "עדכון שיוך הספק נכשל" });
  }
});

router.delete("/clients/:userId/event-vendors/:eventVendorId", requireEventManager, async (req, res) => {
  try {
    const { userId, eventVendorId } = req.params;
    const entry = await EventVendor.findOneAndDelete({ _id: eventVendorId, eventId: userId });
    if (!entry) return res.status(404).json({ message: "שיוך הספק לא נמצא" });
    return res.json({ message: "הספק הוסר מהאירוע", id: String(entry._id) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "הסרת הספק מהאירוע נכשלה" });
  }
});

router.get("/clients/:userId/finance", requireEventManager, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id event finance");
    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const entries = await EventVendor.find({ eventId: userId }).populate("vendorId");
    const eventVendors = entries.map(serializeEventVendor);
    const summary = buildSummary(eventVendors);
    const finance = serializeFinance(user.finance);

    return res.json({
      eventId: String(user._id),
      eventLabel: buildEventLabel(user.event),
      finance,
      summary,
      eventVendors,
      budgetWarning: buildBudgetWarning({
        totalRevenue: summary.totalRevenue,
        targetCoupleBudget: finance.targetCoupleBudget
      }),
      paymentStatusLabels: {
        PENDING: "ממתין לתשלום",
        PARTIAL: "שולם חלקית",
        PAID: "שולם במלואו"
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "טעינת התקציב נכשלה" });
  }
});

router.patch("/clients/:userId/finance", requireEventManager, async (req, res) => {
  try {
    const { userId } = req.params;
    const payload = sanitizeFinancePayload(req.body);
    const user = await User.findByIdAndUpdate(
      userId,
      { finance: payload },
      { new: true, runValidators: true }
    ).select("_id event finance");

    if (!user) return res.status(404).json({ message: "האירוע לא נמצא" });

    const entries = await EventVendor.find({ eventId: userId });
    const summary = buildSummary(entries.map(serializeEventVendor));
    const finance = serializeFinance(user.finance);

    return res.json({
      finance,
      summary,
      budgetWarning: buildBudgetWarning({
        totalRevenue: summary.totalRevenue,
        targetCoupleBudget: finance.targetCoupleBudget
      })
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "עדכון התקציב נכשל" });
  }
});

export default router;
