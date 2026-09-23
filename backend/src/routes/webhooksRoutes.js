import express from "express";
import twilio from "twilio";
import { handleGetAccessDetailsRequest } from "../services/whatsappAccessDetailsService.js";
import { handleIncomingWhatsAppContactShare } from "../services/whatsappContactImportService.js";
import { handleWhatsAppSenderAuth } from "../services/whatsappSenderAuthService.js";
import { handleIncomingWhatsAppRsvp } from "../services/whatsappRsvpService.js";
import {
  recordWhatsAppDeliveryFailure,
  recordWhatsAppDeliveryProgress
} from "../services/whatsappDeliveryLogService.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";
import { extractTwilioVcardMedia } from "../utils/vcardParse.js";

const router = express.Router();

router.post("/twilio-compliance", (req, res) => {
  const { ComplianceProfileSid, VerificationStatus, FailureReason } = req.body;

  console.log(
    `[Twilio Webhook] Profile ${ComplianceProfileSid || "unknown"} status updated to: ${VerificationStatus || "unknown"}`
  );

  if (VerificationStatus === "approved") {
    console.log("Twilio Compliance Approved! We are ready to go live.");
  } else if (VerificationStatus === "rejected") {
    console.error(`Twilio Compliance Rejected. Reason: ${FailureReason || "not provided"}`);
  }

  res.status(200).send("Webhook received successfully");
});

function getWebhookRequestUrl(req) {
  const configured = String(process.env.TWILIO_INBOUND_WEBHOOK_URL || "").trim();
  if (configured) return configured;
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${protocol}://${host}${req.originalUrl}`;
}

function hasValidTwilioSignature(req) {
  if (process.env.TWILIO_VALIDATE_WEBHOOK_SIGNATURE === "false") return true;
  const signature = req.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return false;
  return twilio.validateRequest(authToken, signature, getWebhookRequestUrl(req), req.body);
}

function ackTwilio(res) {
  return res.type("text/xml").status(200).send("<Response></Response>");
}

/**
 * Process inbound WhatsApp after HTTP 200 was already sent (avoids Twilio retries).
 */
async function processInboundWhatsApp(req) {
  const inbound = {
    from: req.body.From,
    body: req.body.Body,
    buttonPayload: req.body.ButtonPayload,
    buttonText: req.body.ButtonText,
    interactiveData: req.body.InteractiveData,
    messageSid: req.body.MessageSid,
    origin: getClientBaseUrl(req)
  };

  const vcardCount = extractTwilioVcardMedia(req.body).length;
  console.log(
    `[Twilio WhatsApp] Inbound: ${req.body.MessageSid || "unknown"} from ${req.body.From || "unknown"} ` +
      `payload=${req.body.ButtonPayload || "-"} text=${req.body.ButtonText || req.body.Body || "-"} ` +
      `numMedia=${req.body.NumMedia || 0} vcardMedia=${vcardCount}`
  );

  // 1) Couple Quick Reply → session credentials (before sender-auth onboarding)
  const accessResult = await handleGetAccessDetailsRequest(inbound);
  if (accessResult.handled) {
    return accessResult;
  }

  // 2) Guest RSVP flow (known guest phone) — must not be captured by auth onboarding
  const rsvpResult = await handleIncomingWhatsAppRsvp(inbound);
  if (rsvpResult?.handled) {
    return rsvpResult;
  }

  // 3) Sender auth / event linking for contact-import onboarding
  const authResult = await handleWhatsAppSenderAuth(req.body);
  if (authResult.handled) {
    return authResult;
  }

  // 4) Authenticated sender + vCard → add guest to linked event
  if (vcardCount > 0 && authResult.allowContactImport) {
    return handleIncomingWhatsAppContactShare(req.body, authResult.link);
  }

  return { handled: false, reason: "unhandled_inbound" };
}

/**
 * Inbound WhatsApp:
 * 1) Couple Quick Reply → session credentials (GET_CREDENTIALS)
 * 2) Guest RSVP button / reply flow
 * 3) Sender auth / link to couple event
 * 4) Contact vCard share → create guest
 *
 * Responds 200 immediately, then processes asynchronously.
 */
async function twilioWhatsAppWebhook(req, res) {
  if (!hasValidTwilioSignature(req)) {
    console.warn("[Twilio WhatsApp] Rejected inbound webhook: invalid Twilio signature");
    return res.status(403).send("Invalid Twilio signature");
  }

  // Acknowledge first — Twilio retries on slow/non-2xx responses.
  ackTwilio(res);

  try {
    await processInboundWhatsApp(req);
  } catch (error) {
    console.error("[Twilio WhatsApp] Incoming interaction failed:", error?.message || error);
  }
}

router.post("/twilio-whatsapp", twilioWhatsAppWebhook);
/** Alias for ops / docs that expect /api/webhooks/whatsapp */
router.post("/whatsapp", twilioWhatsAppWebhook);

function getStatusCallbackRequestUrl(req) {
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host");
  const path = String(req.originalUrl || "").split("?")[0];
  return `${protocol}://${host}${path}`;
}

function hasValidStatusCallbackSignature(req) {
  if (process.env.TWILIO_VALIDATE_WEBHOOK_SIGNATURE === "false") return true;
  const signature = req.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return false;
  return twilio.validateRequest(authToken, signature, getStatusCallbackRequestUrl(req), req.body);
}

router.post("/twilio/message-status", async (req, res) => {
  if (!hasValidStatusCallbackSignature(req)) {
    console.warn("[Twilio status] Rejected callback: invalid signature");
    return res.status(403).send("Invalid Twilio signature");
  }

  const messageStatus = String(req.body?.MessageStatus || "").trim().toLowerCase();
  const messageSid = String(req.body?.MessageSid || "").trim();

  console.log(
    `[Twilio status] ${messageSid || "unknown"} status=${messageStatus || "?"} ` +
      `code=${req.body?.ErrorCode || "-"} ` +
      `message=${req.body?.ErrorMessage || req.body?.ChannelStatusMessage || "-"} ` +
      `to=${req.body?.To || "-"}`
  );

  if (messageStatus === "undelivered" || messageStatus === "failed") {
    try {
      await recordWhatsAppDeliveryFailure({
        messageSid,
        messageStatus,
        errorCode: req.body?.ErrorCode,
        errorMessage: req.body?.ErrorMessage,
        to: req.body?.To,
        from: req.body?.From
      });
    } catch (error) {
      console.error("[Twilio status] Failed to store delivery failure:", error?.message || error);
      return res.status(500).send("Failed to store status");
    }
  } else if (messageStatus === "sent" || messageStatus === "delivered" || messageStatus === "read" || messageStatus === "queued") {
    try {
      await recordWhatsAppDeliveryProgress({ messageSid, messageStatus });
    } catch (error) {
      console.error("[Twilio status] Failed to store delivery progress:", error?.message || error);
    }
  }

  return res.status(200).send("ok");
});

export default router;
