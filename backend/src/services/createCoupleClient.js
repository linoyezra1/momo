import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { buildClientUrl } from "../utils/clientUrl.js";
import { normalizePhone } from "../utils/guestPhone.js";
import { applyCoverToEventPayload } from "../utils/eventCover.js";
import {
  buildCouplePasswordFields,
  normalizeLoginPassword,
  normalizeLoginUsername
} from "../utils/loginCredentials.js";
import {
  applyPhoneRoundsToDealFeatures,
  maxPhoneRoundsFromDealFeatures
} from "../utils/phoneRounds.js";
import { normalizeEventPayload, validateEvent } from "../utils/eventPayload.js";
import {
  normalizeDealPayload,
  PAYMENT_METHOD_LABELS,
  serializeDeal
} from "../utils/dealPayload.js";
import {
  getAdminWelcomeDisplayName,
  sendEventManagerWelcomeWhatsApp
} from "./eventManagerWelcomeWhatsApp.js";

export function buildClientLinks(userId, req) {
  return {
    clientDashboardLink: buildClientUrl("/client/login", req),
    publicEventLink: buildClientUrl(`/event/${userId}`, req)
  };
}

/**
 * Shared couple/client onboarding (admin + agent).
 *
 * @param {object} params
 * @param {object} params.body - request body
 * @param {import("express").Request} params.req
 * @param {"admin"|"agent"|"eventManager"} params.managedBy
 * @param {string} [params.createdByAgentId]
 * @param {"admin"|"agent"} [params.featuresMode]
 * @param {boolean} [params.allowCouponCode]
 * @param {string} [params.welcomeManagerName]
 */
export async function createCoupleClient({
  body,
  req,
  managedBy = "admin",
  createdByAgentId = "",
  featuresMode = "admin",
  allowCouponCode = true,
  welcomeManagerName
}) {
  const { username, password, event, contactPhone } = body || {};

  const normalizedUsername = normalizeLoginUsername(username);
  if (!normalizedUsername || !normalizeLoginPassword(password) || !event) {
    const err = new Error("יש למלא שם משתמש וסיסמה");
    err.status = 400;
    throw err;
  }

  const { plainPassword, passwordHash } = await buildCouplePasswordFields(password, bcrypt);
  const normalizedEvent = await applyCoverToEventPayload(normalizeEventPayload(event), {});
  const eventValidationError = validateEvent(normalizedEvent);
  if (eventValidationError) {
    const err = new Error(eventValidationError);
    err.status = 400;
    throw err;
  }

  const rawPhone = String(contactPhone || body?.bridePhone || "").trim();
  const phone = normalizePhone(rawPhone) || rawPhone;
  if (!phone) {
    const err = new Error("יש להזין מספר טלפון של הכלה (איש קשר)");
    err.status = 400;
    throw err;
  }

  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    const err = new Error("Username already exists");
    err.status = 409;
    throw err;
  }

  const dealOptions = {
    featuresMode,
    allowCouponCode: allowCouponCode && featuresMode !== "agent"
  };
  const normalizedDeal = normalizeDealPayload(body?.deal || {}, {}, dealOptions);

  // Sync premium + phone rounds from features (agent picks features; admin may send both)
  if (featuresMode === "agent") {
    normalizedEvent.isPremiumWhatsappButtonsEnabled =
      normalizedDeal.includedFeatures.isPremiumWhatsappButtonsEnabled === true;
    const maxFromDeal = maxPhoneRoundsFromDealFeatures(normalizedDeal.includedFeatures);
    normalizedDeal.includedFeatures = applyPhoneRoundsToDealFeatures(
      maxFromDeal,
      normalizedDeal.includedFeatures
    );
    normalizedEvent.maxPhoneRounds = maxFromDeal;
  } else {
    normalizedDeal.includedFeatures.isPremiumWhatsappButtonsEnabled =
      normalizedEvent.isPremiumWhatsappButtonsEnabled === true;
    const maxFromDeal = maxPhoneRoundsFromDealFeatures(normalizedDeal.includedFeatures);
    if (maxFromDeal > 0 || normalizedEvent.maxPhoneRounds === 0) {
      // Prefer deal-derived rounds when phone feature flags are set
      if (maxFromDeal > 0) {
        normalizedEvent.maxPhoneRounds = maxFromDeal;
        normalizedDeal.includedFeatures = applyPhoneRoundsToDealFeatures(
          maxFromDeal,
          normalizedDeal.includedFeatures
        );
      }
    }
  }

  // Agents never set coupon via create
  if (featuresMode === "agent") {
    normalizedDeal.couponCode = "";
  }

  const user = await User.create({
    username: normalizedUsername,
    passwordHash,
    loginPassword: plainPassword,
    contactPhone: phone,
    event: normalizedEvent,
    deal: normalizedDeal,
    payment: {
      amountPaid: Number(normalizedDeal.packagePrice ?? normalizedDeal.paymentAmount) || 0,
      paymentMethod:
        PAYMENT_METHOD_LABELS[normalizedDeal.paymentMethod] || normalizedDeal.paymentMethod
    },
    managedBy,
    createdByAgentId: String(createdByAgentId || "").trim()
  });

  const links = buildClientLinks(user._id, req);
  const managerName =
    welcomeManagerName != null ? welcomeManagerName : getAdminWelcomeDisplayName();

  const welcomeWhatsApp = await sendEventManagerWelcomeWhatsApp({
    contactPhone: phone,
    brideName: normalizedEvent.brideName || normalizedEvent.eventNames,
    username: user.username,
    password: plainPassword,
    dashboardUrl: links.clientDashboardLink,
    invitationUrl: links.publicEventLink,
    managerName,
    userId: user._id,
    senderLabel: user.username
  });

  return {
    user,
    plainPassword,
    links,
    welcomeWhatsApp,
    deal: serializeDeal(user.deal || {}, user.payment || {}, dealOptions)
  };
}
