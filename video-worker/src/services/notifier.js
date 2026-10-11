const axios = require("axios");

const READY_TEXT = "הסרטון שלכם מוכן! 🎬";

function toWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  const normalized = intl.startsWith("972") ? intl : `972${intl}`;
  return `whatsapp:+${normalized}`;
}

/**
 * Send the finished film as a WhatsApp video to job.phone.
 */
async function notifyCouple(job) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const to = toWhatsApp(job?.phone);
  const mediaUrl = String(job?.finalVideoUrl || "").trim();
  if (!accountSid || !authToken || !to) throw new Error("twilio_notify_not_configured");
  if (!mediaUrl.startsWith("http")) throw new Error("final_video_url_missing");

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", READY_TEXT);
  params.set("MediaUrl", mediaUrl);

  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else {
    const from = String(process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER || "").trim();
    if (!from) throw new Error("twilio_from_missing");
    params.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:+${from.replace(/\D/g, "")}`);
  }

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    params.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 20000
    }
  );
}

module.exports = { notifyCouple, READY_TEXT };
