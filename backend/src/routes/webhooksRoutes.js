import express from "express";
import twilio from "twilio";
import { handleGetAccessDetailsRequest } from "../services/whatsappAccessDetailsService.js";
import { handleIncomingWhatsAppRsvp } from "../services/whatsappRsvpService.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";

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

  console.log(
    `[Twilio WhatsApp] Inbound: ${req.body.MessageSid || "unknown"} from ${req.body.From || "unknown"} payload=${req.body.ButtonPayload || "-"} text=${req.body.ButtonText || req.body.Body || "-"}`
  );

  const accessResult = await handleGetAccessDetailsRequest(inbound);
  if (accessResult.handled) {
    return accessResult;
  }

  return handleIncomingWhatsAppRsvp(inbound);
}

/**
 * Inbound WhatsApp:
 * 1) Couple Quick Reply → session credentials (GET_CREDENTIALS)
 * 2) Guest RSVP button / reply flow
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

export default router;
