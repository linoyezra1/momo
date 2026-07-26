import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import ActivationCode from "../models/ActivationCode.js";
import Lead from "../models/Lead.js";
import { buildClientUrl } from "../utils/clientUrl.js";
import { normalizePhone } from "../utils/guestPhone.js";
import {
  applyCouplePassword,
  buildCouplePasswordFields,
  normalizeLoginPassword,
  normalizeLoginUsername
} from "../utils/loginCredentials.js";
import {
  applyPhoneRoundsToDealFeatures,
  maxPhoneRoundsFromDealFeatures
} from "../utils/phoneRounds.js";
import {
  requireAdmin,
  signAdminToken,
  validateAdminCredentials,
  verifyAdminToken
} from "../middleware/adminAuth.js";
import {
  getAdminWelcomeDisplayName,
  sendEventManagerWelcomeWhatsApp,
  sendLoginCredentialsQuickReply
} from "../services/eventManagerWelcomeWhatsApp.js";

const router = express.Router();

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  const validation = validateAdminCredentials(username, password);
  if (validation.reason === "not_configured") {
    return res.status(503).json({ message: "התחברות מנהל לא מוגדרת בשרת" });
  }
  if (!validation.ok) {
    return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
  }

  try {
    const token = signAdminToken();
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create admin session" });
  }
});

router.get("/session", (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true });
});

router.use(requireAdmin);

function normalizeEventPayload(rawEvent) {
  const eventType = String(rawEvent?.eventType || "").trim() || "חתונה";
  const groomName = String(rawEvent?.groomName || "").trim();
  const brideName = String(rawEvent?.brideName || "").trim();
  const batMitzvahName = String(rawEvent?.batMitzvahName || "").trim();
  const parentName1 = String(rawEvent?.parentName1 || "").trim();
  const parentName2 = String(rawEvent?.parentName2 || "").trim();
  const requestedMaxPhoneRounds = Number(rawEvent?.maxPhoneRounds);
  const maxPhoneRounds =
    Number.isInteger(requestedMaxPhoneRounds) &&
    requestedMaxPhoneRounds >= 0 &&
    requestedMaxPhoneRounds <= 4
      ? requestedMaxPhoneRounds
      : 0;

  const baseEvent = {
    eventType,
    venueName: String(rawEvent?.venueName || "").trim(),
    city: String(rawEvent?.city || "").trim(),
    streetAndNumber: String(rawEvent?.streetAndNumber || "").trim(),
    eventDate: String(rawEvent?.eventDate || "").trim(),
    eventDateHebrew:
      eventType === "ברית" ? String(rawEvent?.eventDateHebrew || "").trim() : "",
    eventTime: String(rawEvent?.eventTime || "").trim(),
    maxPhoneRounds,
    isPremiumWhatsappButtonsEnabled: rawEvent?.isPremiumWhatsappButtonsEnabled === true,
    imageDataUrl: String(rawEvent?.imageDataUrl || "").trim(),
    groomName,
    brideName,
    batMitzvahName,
    parentName1,
    parentName2
  };

  if (eventType === "חתונה") {
    return {
      ...baseEvent,
      eventNames: `${groomName} & ${brideName}`.trim()
    };
  }

  if (eventType === "ברית") {
    return {
      ...baseEvent,
      eventNames: `${parentName1} ו${parentName2}`.trim()
    };
  }

  if (eventType === "בת מצווה") {
    return {
      ...baseEvent,
      eventNames: batMitzvahName
    };
  }

  return {
    ...baseEvent,
    eventNames: String(rawEvent?.eventNames || "").trim()
  };
}

function validateEvent(normalizedEvent) {
  if (normalizedEvent.eventType === "חתונה") {
    if (!normalizedEvent.groomName || !normalizedEvent.brideName) {
      return "יש למלא שם חתן ושם כלה";
    }
  }

  return "";
}

function buildClientLinks(userId, req) {
  return {
    clientDashboardLink: buildClientUrl("/client/login", req),
    publicEventLink: buildClientUrl(`/event/${userId}`, req)
  };
}

function normalizePaymentPayload(rawPayment) {
  const amountRaw = rawPayment?.amountPaid ?? rawPayment?.paymentAmount;
  let amountPaid = 0;
  if (amountRaw !== "" && amountRaw != null && !Number.isNaN(Number(amountRaw))) {
    amountPaid = Math.max(0, Number(amountRaw));
  }
  const paymentMethod =
    rawPayment?.paymentMethod == null ? "" : String(rawPayment.paymentMethod).trim();
  return { amountPaid, paymentMethod };
}

const PACKAGE_TYPES = new Set(["custom", "digital", "vip_2_rounds", "vip_4_rounds"]);
const DEAL_PAYMENT_METHODS = new Set(["bit", "paybox", "bank_transfer", "cash", "other"]);
const FEATURE_KEYS = [
  "whatsappRound1",
  "whatsappRound2",
  "isPremiumWhatsappButtonsEnabled",
  "phoneCallsRound1",
  "phoneCallsRound2",
  "phoneCallsRound3",
  "phoneCallsRound4",
  "eventDayReminder",
  "eventDayTableNumber",
  "canSendTableWhatsApp",
  "thankYouMessage"
];

const PAYMENT_METHOD_LABELS = {
  bit: "ביט",
  paybox: "פייבוקס",
  bank_transfer: "העברה בנקאית",
  cash: "מזומן",
  other: "אחר"
};

function defaultIncludedFeatures() {
  return {
    whatsappRound1: true,
    whatsappRound2: false,
    isPremiumWhatsappButtonsEnabled: false,
    phoneCallsRound1: false,
    phoneCallsRound2: false,
    phoneCallsRound3: false,
    phoneCallsRound4: false,
    eventDayReminder: true,
    eventDayTableNumber: false,
    canSendTableWhatsApp: false,
    thankYouMessage: true
  };
}

function normalizeDealPayload(rawDeal = {}, existingDeal = {}) {
  const existing = existingDeal?.toObject ? existingDeal.toObject() : existingDeal || {};
  const packageType = PACKAGE_TYPES.has(String(rawDeal?.packageType || "").trim())
    ? String(rawDeal.packageType).trim()
    : existing.packageType || "custom";

  const baseFeatures = {
    ...defaultIncludedFeatures(),
    ...(existing.includedFeatures || {})
  };
  const incomingFeatures = rawDeal?.includedFeatures || {};
  const includedFeatures = { ...baseFeatures };
  for (const key of FEATURE_KEYS) {
    if (typeof incomingFeatures[key] === "boolean") {
      includedFeatures[key] = incomingFeatures[key];
    }
  }

  // Keep table-dispatch aliases in sync (admin toggles either key).
  if (typeof incomingFeatures.canSendTableWhatsApp === "boolean") {
    includedFeatures.eventDayTableNumber = incomingFeatures.canSendTableWhatsApp;
    includedFeatures.canSendTableWhatsApp = incomingFeatures.canSendTableWhatsApp;
  } else if (typeof incomingFeatures.eventDayTableNumber === "boolean") {
    includedFeatures.canSendTableWhatsApp = incomingFeatures.eventDayTableNumber;
    includedFeatures.eventDayTableNumber = incomingFeatures.eventDayTableNumber;
  } else {
    const enabled = Boolean(
      includedFeatures.canSendTableWhatsApp || includedFeatures.eventDayTableNumber
    );
    includedFeatures.eventDayTableNumber = enabled;
    includedFeatures.canSendTableWhatsApp = enabled;
  }

  let paymentAmount = Number(existing.paymentAmount || 0);
  if (rawDeal?.paymentAmount !== undefined && rawDeal?.paymentAmount !== "") {
    const parsed = Number(rawDeal.paymentAmount);
    paymentAmount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  const methodRaw = String(rawDeal?.paymentMethod || existing.paymentMethod || "other").trim();
  const paymentMethod = DEAL_PAYMENT_METHODS.has(methodRaw) ? methodRaw : "other";

  return {
    packageType,
    includedFeatures,
    marketingSource:
      rawDeal?.marketingSource != null
        ? String(rawDeal.marketingSource).trim()
        : String(existing.marketingSource || "").trim(),
    paymentAmount,
    paymentMethod,
    adminNotes:
      rawDeal?.adminNotes != null
        ? String(rawDeal.adminNotes).trim()
        : String(existing.adminNotes || "").trim()
  };
}

function serializeDeal(deal, payment = {}) {
  const normalized = normalizeDealPayload(deal || {}, deal || {});
  // Prefer deal payment; fall back to legacy payment for older clients
  if (!deal?.paymentAmount && payment?.amountPaid) {
    normalized.paymentAmount = Math.max(0, Number(payment.amountPaid) || 0);
  }
  if ((!deal?.paymentMethod || deal.paymentMethod === "other") && payment?.paymentMethod) {
    const legacy = String(payment.paymentMethod).trim().toLowerCase();
    if (DEAL_PAYMENT_METHODS.has(legacy)) {
      normalized.paymentMethod = legacy;
    }
  }
  return normalized;
}

function applyDealToUser(user, rawDeal) {
  const deal = normalizeDealPayload(rawDeal, user.deal || {});
  const maxFromDeal = maxPhoneRoundsFromDealFeatures(deal.includedFeatures);
  deal.includedFeatures = applyPhoneRoundsToDealFeatures(maxFromDeal, deal.includedFeatures);
  user.deal = deal;
  const premiumButtonsEnabled = Boolean(
    deal.includedFeatures.isPremiumWhatsappButtonsEnabled
  );
  user.set("event.isPremiumWhatsappButtonsEnabled", premiumButtonsEnabled);
  user.set("event.maxPhoneRounds", maxFromDeal);
  user.markModified("event");
  // Keep legacy payment in sync for revenue totals / older UI
  user.payment = {
    amountPaid: deal.paymentAmount,
    paymentMethod: PAYMENT_METHOD_LABELS[deal.paymentMethod] || deal.paymentMethod
  };
  return deal;
}

router.get("/clients", async (req, res) => {
  try {
    const users = await User.find(
      {},
      "username event createdAt payment deal loginPassword contactPhone"
    ).sort({
      createdAt: -1
    });
    const clients = users.map((user) => {
      const links = buildClientLinks(user._id, req);
      const payment = normalizePaymentPayload(user.payment || {});
      const deal = serializeDeal(user.deal || {}, payment);
      return {
        userId: user._id,
        username: user.username,
        loginPassword: user.loginPassword || "",
        contactPhone: user.contactPhone || "",
        event: user.event,
        payment,
        deal,
        createdAt: user.createdAt,
        ...links
      };
    });
    const totalRevenue = clients.reduce((sum, client) => {
      const fromDeal = Number(client.deal?.paymentAmount);
      const fromPayment = Number(client.payment?.amountPaid) || 0;
      return sum + (Number.isFinite(fromDeal) && fromDeal > 0 ? fromDeal : fromPayment);
    }, 0);
    return res.json({ clients, totalRevenue });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load clients", error: error.message });
  }
});

router.post("/create-client", async (req, res) => {
  try {
    const { username, password, event, contactPhone } = req.body;

    const normalizedUsername = normalizeLoginUsername(username);
    if (!normalizedUsername || !normalizeLoginPassword(password) || !event) {
      return res.status(400).json({ message: "יש למלא שם משתמש וסיסמה" });
    }
    const { plainPassword, passwordHash } = await buildCouplePasswordFields(password, bcrypt);
    const normalizedEvent = normalizeEventPayload(event);
    const eventValidationError = validateEvent(normalizedEvent);
    if (eventValidationError) {
      return res.status(400).json({ message: eventValidationError });
    }

    const rawPhone = String(contactPhone || req.body?.bridePhone || "").trim();
    const phone = normalizePhone(rawPhone) || rawPhone;
    if (!phone) {
      return res.status(400).json({ message: "יש להזין מספר טלפון של הכלה (איש קשר)" });
    }

    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const normalizedDeal = normalizeDealPayload(req.body?.deal || {}, {});
    normalizedDeal.includedFeatures.isPremiumWhatsappButtonsEnabled =
      normalizedEvent.isPremiumWhatsappButtonsEnabled === true;

    const user = await User.create({
      username: normalizedUsername,
      passwordHash,
      loginPassword: plainPassword,
      contactPhone: phone,
      event: normalizedEvent,
      deal: normalizedDeal,
      managedBy: "admin"
    });

    const links = buildClientLinks(user._id, req);

    const welcomeWhatsApp = await sendEventManagerWelcomeWhatsApp({
      contactPhone: phone,
      brideName: normalizedEvent.brideName || normalizedEvent.eventNames,
      username: user.username,
      password: plainPassword,
      dashboardUrl: links.clientDashboardLink,
      invitationUrl: links.publicEventLink,
      managerName: getAdminWelcomeDisplayName(),
      userId: user._id,
      senderLabel: user.username
    });

    return res.status(201).json({
      userId: user._id,
      ...links,
      credentials: { username: user.username, password: plainPassword },
      welcomeWhatsApp: {
        sent: Boolean(welcomeWhatsApp.sent),
        reason: welcomeWhatsApp.reason || null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create client", error: error.message });
  }
});

router.patch("/clients/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, password, event, contactPhone, deal } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (username) {
      const nextUsername = normalizeLoginUsername(username);
      if (nextUsername && nextUsername !== user.username) {
        const existing = await User.findOne({ username: nextUsername }).select("_id");
        if (existing) {
          return res.status(409).json({ message: "Username already exists" });
        }
        user.username = nextUsername;
      }
    }

    if (password) {
      try {
        await applyCouplePassword(user, password, bcrypt);
      } catch {
        return res.status(400).json({ message: "סיסמה אינה תקינה" });
      }
    }

    if (contactPhone != null || req.body?.bridePhone != null) {
      const rawPhone = String(contactPhone || req.body?.bridePhone || "").trim();
      user.contactPhone = normalizePhone(rawPhone) || rawPhone;
    }

    if (event) {
      const normalizedEvent = normalizeEventPayload(event);
      const eventValidationError = validateEvent(normalizedEvent);
      if (eventValidationError) {
        return res.status(400).json({ message: eventValidationError });
      }
      const previousEvent = user.event?.toObject
        ? user.event.toObject()
        : { ...(user.event || {}) };
      user.event = {
        ...normalizedEvent,
        welcomeParagraph: previousEvent.welcomeParagraph || "",
        eventDetailsParagraph: previousEvent.eventDetailsParagraph || "",
        closingParagraph: previousEvent.closingParagraph || ""
      };
      const synchronizedDeal = normalizeDealPayload({}, user.deal || {});
      synchronizedDeal.includedFeatures.isPremiumWhatsappButtonsEnabled =
        normalizedEvent.isPremiumWhatsappButtonsEnabled === true;
      synchronizedDeal.includedFeatures = applyPhoneRoundsToDealFeatures(
        normalizedEvent.maxPhoneRounds,
        synchronizedDeal.includedFeatures
      );
      user.deal = synchronizedDeal;
    }

    if (deal && typeof deal === "object") {
      applyDealToUser(user, deal);
    }

    await user.save();
    const links = buildClientLinks(user._id, req);
    const payment = normalizePaymentPayload(user.payment || {});
    return res.json({
      message: "Client updated",
      userId: user._id,
      username: user.username,
      loginPassword: user.loginPassword || "",
      contactPhone: user.contactPhone || "",
      payment,
      deal: serializeDeal(user.deal || {}, payment),
      ...links
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update client", error: error.message });
  }
});

router.patch("/clients/:userId/payment", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    user.payment = normalizePaymentPayload(req.body);
    // Mirror into deal for the unified deal section
    const paymentMethodRaw = String(req.body?.paymentMethod || "").trim().toLowerCase();
    const mappedMethod = DEAL_PAYMENT_METHODS.has(paymentMethodRaw)
      ? paymentMethodRaw
      : user.deal?.paymentMethod || "other";
    applyDealToUser(user, {
      ...(user.deal?.toObject?.() || user.deal || {}),
      paymentAmount: user.payment.amountPaid,
      paymentMethod: mappedMethod
    });
    await user.save();

    return res.json({
      message: "Payment updated",
      userId: user._id,
      payment: user.payment,
      deal: serializeDeal(user.deal || {}, user.payment)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update payment" });
  }
});

router.patch("/clients/:userId/deal", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const deal = applyDealToUser(user, req.body?.deal || req.body || {});
    await user.save();

    return res.json({
      message: "פרטי העסקה נשמרו",
      userId: user._id,
      deal,
      payment: user.payment,
      event: user.event
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update deal" });
  }
});

/** Manual resend: get_login_credentials Quick Reply template (GET_CREDENTIALS). */
router.post("/clients/:userId/send-credentials", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select(
      "username contactPhone event.brideName event.eventNames"
    );
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const phone = String(user.contactPhone || "").trim();
    if (!phone) {
      return res.status(400).json({
        message: "ללקוח אין מספר טלפון שמור — עדכנו טלפון איש קשר לפני שליחה"
      });
    }

    const result = await sendLoginCredentialsQuickReply({
      contactPhone: phone,
      userId: user._id,
      username: user.username,
      senderLabel: `admin:${user.username}`
    });

    if (!result.sent) {
      const reasonMessages = {
        twilio_not_configured: "Twilio לא מוגדר בשרת",
        invalid_phone: "מספר הטלפון אינו תקין לשליחת וואטסאפ",
        credentials_qr_template_missing: "חסר SID לתבנית get_login_credentials",
        template_missing: "חסר SID לתבנית get_login_credentials",
        send_failed: result.error || "שליחת ההודעה נכשלה"
      };
      return res.status(400).json({
        message: reasonMessages[result.reason] || "שליחת הרשאות נכשלה",
        reason: result.reason || "send_failed"
      });
    }

    return res.json({
      message: "תבנית פרטי הגישה נשלחה בוואטסאפ",
      sent: true,
      sid: result.sid || "",
      contentSid: result.contentSid || "",
      phone
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to send credentials WhatsApp"
    });
  }
});

router.get("/activation-codes", async (req, res) => {
  try {
    const codes = await ActivationCode.find().sort({ createdAt: -1 });
    return res.json({ codes });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load activation codes", error: error.message });
  }
});

router.post("/activation-codes", async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const totalCredits = Math.max(1, Number(req.body?.total_credits || req.body?.totalCredits || 0));
    const note = String(req.body?.note || "").trim();
    const userId = req.body?.userId || req.body?.redeemedByUserId || null;

    if (!code) {
      return res.status(400).json({ message: "יש להזין קוד רכישה" });
    }

    const existing = await ActivationCode.findOne({ code });
    if (existing) {
      return res.status(409).json({ message: "קוד זה כבר קיים במערכת" });
    }

    const activationCode = await ActivationCode.create({
      code,
      total_credits: totalCredits,
      remaining_credits: totalCredits,
      note,
      redeemedByUserId: userId || null
    });

    return res.status(201).json({ message: "קוד רכישה נוצר בהצלחה", code: activationCode });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create activation code" });
  }
});

router.get("/clients/:userId/whatsapp-quota", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const allCoupons = await ActivationCode.find({ redeemedByUserId: userId })
      .sort({ createdAt: -1 })
      .select("code total_credits remaining_credits isActive note createdAt updatedAt");

    const mapCoupon = (item) => ({
      codeId: item._id,
      code: item.code,
      total_credits: item.total_credits,
      remaining_credits: item.remaining_credits,
      isActive: item.isActive,
      note: item.note || "",
      createdAt: item.createdAt
    });

    const quotas = allCoupons.filter((item) => item.isActive).map(mapCoupon);
    const usable = quotas.filter((item) => item.remaining_credits > 0);
    // Backward-compatible single "quota" = newest usable (or newest active)
    const codeRecord = usable[0] || quotas[0] || null;

    return res.json({
      quota: codeRecord,
      quotas,
      history: allCoupons.map(mapCoupon)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load client quota" });
  }
});

function buildUniqueCouponCode(username, totalCredits) {
  const base = String(username || "CLIENT")
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase() || "CLIENT";
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MOMO-${base}-${totalCredits}-${stamp}${rand}`;
}

router.post("/clients/:userId/whatsapp-quota", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const totalCredits = Math.max(1, Number(req.body?.total_credits || req.body?.totalCredits || 0));
    if (!totalCredits || Number.isNaN(totalCredits)) {
      return res.status(400).json({ message: "יש להזין כמות הודעות תקינה" });
    }

    const requestedCode = String(req.body?.code || "").trim().toUpperCase();
    const note = String(req.body?.note || "").trim() || `לקוח: ${user.username}`;

    let code = requestedCode || buildUniqueCouponCode(user.username, totalCredits);

    // Never update an existing coupon — only create a brand-new document.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const duplicate = await ActivationCode.findOne({ code }).select("_id code");
      if (!duplicate) break;
      if (requestedCode) {
        return res.status(409).json({
          message: `הקוד ${requestedCode} כבר קיים במערכת. בחרו שם קוד אחר ליצירת קופון חדש.`
        });
      }
      code = buildUniqueCouponCode(user.username, totalCredits);
    }

    const stillDuplicate = await ActivationCode.findOne({ code }).select("_id");
    if (stillDuplicate) {
      return res.status(409).json({ message: "לא ניתן ליצור קוד ייחודי. נסו שוב." });
    }

    // IMPORTANT: do NOT deactivate / overwrite previous coupons.
    // A client may hold multiple independent active coupons (e.g. code X and code Y).
    const codeRecord = await ActivationCode.create({
      code,
      total_credits: totalCredits,
      remaining_credits: totalCredits,
      isActive: true,
      note,
      redeemedByUserId: userId
    });

    const allCoupons = await ActivationCode.find({ redeemedByUserId: userId })
      .sort({ createdAt: -1 })
      .select("code total_credits remaining_credits isActive note createdAt");

    const mapCoupon = (item) => ({
      codeId: item._id,
      code: item.code,
      total_credits: item.total_credits,
      remaining_credits: item.remaining_credits,
      isActive: item.isActive,
      note: item.note || "",
      createdAt: item.createdAt
    });

    return res.status(201).json({
      message: `נוצר קופון חדש ${code} עם ${totalCredits} הודעות (בנוסף לקופונים הקיימים של הלקוח)`,
      quota: mapCoupon(codeRecord),
      quotas: allCoupons.filter((item) => item.isActive).map(mapCoupon),
      history: allCoupons.map(mapCoupon)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "קוד זה כבר קיים במערכת. בחרו שם קוד אחר ליצירת קופון חדש."
      });
    }
    return res.status(500).json({ message: error.message || "Failed to assign client quota" });
  }
});

router.patch("/activation-codes/:codeId", async (req, res) => {
  try {
    const { codeId } = req.params;
    const codeRecord = await ActivationCode.findById(codeId);
    if (!codeRecord) {
      return res.status(404).json({ message: "קוד לא נמצא" });
    }

    if (typeof req.body?.isActive === "boolean") {
      codeRecord.isActive = req.body.isActive;
    }
    if (req.body?.remaining_credits != null && !Number.isNaN(Number(req.body.remaining_credits))) {
      const nextRemaining = Math.max(0, Number(req.body.remaining_credits));
      codeRecord.remaining_credits = nextRemaining;
      if (nextRemaining > codeRecord.total_credits) {
        codeRecord.total_credits = nextRemaining;
      }
    }
    if (req.body?.note != null) {
      codeRecord.note = String(req.body.note).trim();
    }

    await codeRecord.save();
    return res.json({ message: "קוד עודכן", code: codeRecord });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update activation code" });
  }
});

router.delete("/clients/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    await Guest.deleteMany({ userId });
    return res.json({ message: "Client deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete client" });
  }
});

router.get("/leads", async (_req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({
      leads: leads.map((lead) => ({
        id: lead._id,
        fullName: lead.fullName,
        phone: lead.phone,
        eventDate: lead.eventDate || "",
        message: lead.message || "",
        status: lead.status || "new",
        source: lead.source || "landing",
        createdAt: lead.createdAt
      })),
      newCount: leads.filter((lead) => lead.status === "new").length
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load leads" });
  }
});

router.patch("/leads/:leadId", async (req, res) => {
  try {
    const { leadId } = req.params;
    const status = String(req.body?.status || "").trim();
    if (!["new", "contacted", "closed"].includes(status)) {
      return res.status(400).json({ message: "סטטוס לא תקין" });
    }

    const lead = await Lead.findByIdAndUpdate(
      leadId,
      { status },
      { new: true, runValidators: true }
    );
    if (!lead) {
      return res.status(404).json({ message: "הפנייה לא נמצאה" });
    }

    return res.json({
      message: "סטטוס עודכן",
      lead: {
        id: lead._id,
        fullName: lead.fullName,
        phone: lead.phone,
        eventDate: lead.eventDate || "",
        message: lead.message || "",
        status: lead.status,
        source: lead.source || "landing",
        createdAt: lead.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update lead" });
  }
});

export default router;
