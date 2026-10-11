/**
 * Couple asks the existing guest-import bot (0585915109) for a one-time intro animation.
 * This service only collects answers and photos, then stores a pending VideoJob.
 * Rendering runs in video-worker so RSVP traffic stays on this process.
 */
import VideoJob from "../models/VideoJob.js";
import { normalizePhone } from "../utils/guestPhone.js";
import { uploadCoverBuffer } from "./coverStorage.js";
import { sendTwilioWhatsAppMessage, toTwilioWhatsAppAddress } from "../utils/twilioWhatsApp.js";
import { findUsersByWhatsAppPhone } from "./whatsappAccessDetailsService.js";

export const INTRO_ANIMATION_TRIGGER =
  "אני רוצה ליצור סרטון אנימציה של ההיכרות שלנו לאישורי ההגעה לאורחים";

const QUESTIONS = {
  meeting: "איפה ואיך הכרתם? (למשל: מסיבה, צבא, טינדר)",
  hobby: "ספרו בקצרה על 2 חוויות משמעותיות ביחד (למשל: טיול, קניית רכב, תחביב)",
  hobby2: "נשמרה חוויה אחת. מה החוויה השנייה?",
  proposal: "איפה ואיך הייתה הצעת הנישואין? (למשל: מסעדה, שקיעה בים)",
  selfie: "שלחו תמונת סלפי ברורה של שניכם (חשוב שיראו את הפנים היטב)",
  invitation: "שלחו את תמונת ההזמנה שלכם"
};

const LOCK_MESSAGE =
  "הסרטון בהכנה, נעדכן כאן כשהוא מוכן. לא ניתן לשנות את הסרטון, הוא חד-פעמי.";

const BUSY_STATUSES = ["pending", "generating_anchor", "rendering_clips", "assembling"];

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isIntroAnimationTrigger(text) {
  return compact(text) === compact(INTRO_ANIMATION_TRIGGER);
}

function splitHobbies(text) {
  const raw = String(text || "").trim();
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 2) return [lines[0], lines.slice(1).join(" ")];
  const byAlso = raw.split(/\s+וגם\s+/);
  if (byAlso.length >= 2 && byAlso[0].trim() && byAlso[1].trim()) {
    return [byAlso[0].trim(), byAlso.slice(1).join(" וגם ").trim()];
  }
  return [raw, ""];
}

function listInboundImages(body = {}) {
  const count = Math.max(0, Number(body.NumMedia) || 0);
  const images = [];
  for (let index = 0; index < count; index += 1) {
    const url = String(body[`MediaUrl${index}`] || "").trim();
    const type = String(body[`MediaContentType${index}`] || "").trim().toLowerCase();
    if (!url || !type.startsWith("image/")) continue;
    images.push({ url, type: type === "image/jpg" ? "image/jpeg" : type });
  }
  return images;
}

function basicAuthHeader(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function downloadTwilioMedia(mediaUrl) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!accountSid || !authToken) throw new Error("twilio_credentials_missing");

  const first = await fetch(mediaUrl, {
    headers: { Authorization: basicAuthHeader(accountSid, authToken) },
    redirect: "manual"
  });
  let response = first;
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("location");
    if (!location) throw new Error("twilio_media_redirect_missing");
    response = await fetch(location, { redirect: "follow" });
  }
  if (!response.ok) throw new Error(`twilio_media_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function reply(phone, body, userId) {
  const to = toTwilioWhatsAppAddress(phone);
  if (!to) return;
  await sendTwilioWhatsAppMessage({
    to,
    body,
    userId,
    recipientPhone: phone
  });
}

function invitationFromEvent(event = {}) {
  const url = String(event.cover?.url || "").trim();
  return url.startsWith("http") ? url : "";
}

function profileFromUser(user) {
  const event = user?.event || {};
  return {
    groomName: String(event.groomName || "").trim(),
    brideName: String(event.brideName || "").trim(),
    weddingDate: String(event.eventDate || "").trim(),
    venueName: String(event.venueName || "").trim(),
    invitationUrl: invitationFromEvent(event)
  };
}

async function storeImage({ userId, media, label }) {
  const buffer = await downloadTwilioMedia(media.url);
  const uploaded = await uploadCoverBuffer(buffer, {
    mimeType: media.type,
    folder: "momo/intro-animations",
    publicId: `${userId}-${label}`
  });
  return uploaded.url;
}

async function enqueue(job) {
  job.step = "done";
  job.status = "pending";
  job.lockedAt = new Date();
  job.errorMessage = "";
  await job.save();
  await reply(job.phone, LOCK_MESSAGE, job.userId);
}

export async function handleIntroAnimationRequest({ from, body, twilioBody } = {}) {
  const text = String(body || "").trim();
  const phone = normalizePhone(String(from || "").replace(/^whatsapp:/i, ""));
  if (!phone) return { handled: false, reason: "no_phone" };

  const openJob = await VideoJob.findOne({ phone, status: "collecting" }).sort({ createdAt: -1 });
  const triggered = isIntroAnimationTrigger(text);
  if (!triggered && !openJob) return { handled: false, reason: "not_intro_animation" };

  const users = await findUsersByWhatsAppPhone(phone);
  const user = users[0];
  if (!user) {
    await reply(
      phone,
      "המספר הזה לא משויך לחשבון פעיל. שלחו מהוואטסאפ של הטלפון שרשום במערכת."
    );
    return { handled: true, reason: "user_not_found" };
  }

  const finished = await VideoJob.findOne({
    userId: user._id,
    status: { $in: [...BUSY_STATUSES, "completed", "failed"] }
  }).sort({ createdAt: -1 });

  if (finished && !openJob) {
    if (finished.status === "completed" && finished.finalVideoUrl) {
      await reply(
        phone,
        `הסרטון כבר מוכן:\n${finished.finalVideoUrl}\nלא ניתן לשנות אותו, הוא חד-פעמי.`,
        user._id
      );
    } else if (finished.status === "failed") {
      await reply(
        phone,
        "הפקת הסרטון נתקלה בתקלה ואנחנו מטפלים בה. אי אפשר להתחיל סרטון חדש, הוא חד-פעמי.",
        user._id
      );
    } else {
      await reply(phone, LOCK_MESSAGE, user._id);
    }
    return { handled: true, reason: "already_locked" };
  }

  let job = openJob;
  if (!job) {
    const profile = profileFromUser(user);
    if (!profile.groomName || !profile.brideName || !profile.weddingDate) {
      await reply(
        phone,
        "כדי ליצור את הסרטון צריך שם חתן, שם כלה ותאריך חתונה במערכת. השלימו אותם ושלחו שוב את ההודעה.",
        user._id
      );
      return { handled: true, reason: "profile_incomplete" };
    }
    job = await VideoJob.create({
      userId: user._id,
      phone,
      ...profile,
      step: "meeting",
      status: "collecting"
    });
    await reply(phone, QUESTIONS.meeting, user._id);
    return { handled: true, reason: "started" };
  }

  const images = listInboundImages(twilioBody);
  const answer = text;
  job.story = job.story || {};

  if (job.step === "meeting" || job.step === "hobby" || job.step === "hobby2" || job.step === "proposal") {
    if (!answer || isIntroAnimationTrigger(answer)) {
      await reply(phone, QUESTIONS[job.step], user._id);
      return { handled: true, reason: "repeat_question" };
    }
  }

  if (job.step === "meeting") {
    job.story.meeting = answer;
    job.markModified("story");
    job.step = "hobby";
    await job.save();
    await reply(phone, QUESTIONS.hobby, user._id);
    return { handled: true, reason: "meeting_saved" };
  }

  if (job.step === "hobby") {
    const [first, second] = splitHobbies(answer);
    job.story.hobby1 = first;
    job.markModified("story");
    if (!second) {
      job.step = "hobby2";
      await job.save();
      await reply(phone, QUESTIONS.hobby2, user._id);
      return { handled: true, reason: "need_second_hobby" };
    }
    job.story.hobby2 = second;
    job.markModified("story");
    job.step = "proposal";
    await job.save();
    await reply(phone, QUESTIONS.proposal, user._id);
    return { handled: true, reason: "hobbies_saved" };
  }

  if (job.step === "hobby2") {
    job.story.hobby2 = answer;
    job.markModified("story");
    job.step = "proposal";
    await job.save();
    await reply(phone, QUESTIONS.proposal, user._id);
    return { handled: true, reason: "hobby2_saved" };
  }

  if (job.step === "proposal") {
    job.story.proposal = answer;
    job.markModified("story");
    job.step = "selfie";
    await job.save();
    await reply(phone, QUESTIONS.selfie, user._id);
    return { handled: true, reason: "proposal_saved" };
  }

  if (job.step === "selfie" || job.step === "invitation") {
    if (!images.length) {
      await reply(phone, QUESTIONS[job.step], user._id);
      return { handled: true, reason: "need_image" };
    }
    try {
      const url = await storeImage({
        userId: user._id,
        media: images[0],
        label: job.step === "selfie" ? "selfie" : "invitation"
      });
      if (job.step === "selfie") {
        job.selfieUrl = url;
        if (job.invitationUrl) {
          await enqueue(job);
          return { handled: true, reason: "queued" };
        }
        job.step = "invitation";
        await job.save();
        await reply(phone, QUESTIONS.invitation, user._id);
        return { handled: true, reason: "need_invitation" };
      }
      job.invitationUrl = url;
      await enqueue(job);
      return { handled: true, reason: "queued" };
    } catch (error) {
      console.error("[intro-animation] image save failed:", error?.message || error);
      await reply(phone, "לא הצלחנו לשמור את התמונה. שלחו אותה שוב, בפורמט JPG או PNG.", user._id);
      return { handled: true, reason: "image_failed" };
    }
  }

  return { handled: true, reason: "noop" };
}
