import ActivationCode from "../models/ActivationCode.js";
import Guest from "../models/Guest.js";
import {
  buildConferenceContentVariables,
  buildTwilioContentVariables,
  CONFERENCE_RSVP_CONTENT_SID_DEFAULT,
  fetchTwilioContentTemplate,
  isConferenceContentSid,
  isTwilioConfigured,
  logTwilioContentApprovalDiagnostics,
  logTwilioContentSidEnvSnapshot,
  resolveConferenceContentSid,
  resolveEventCoverMediaPath,
  toWhatsAppCoverMediaVariable,
  sendConferenceInviteWhatsApp,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import {
  buildInviteUrlButtonVariable,
  buildWazeNavigationLink,
  buildWazeQueryVariable,
  getTemplateFieldKeyMap,
  resolveInviteTemplateRouting
} from "../utils/whatsappInviteTemplates.js";
import {
  buildPublicEventLink,
  buildWhatsAppTemplateDefaults
} from "../utils/whatsappMessage.js";
import {
  resolveWhatsAppInviteParagraphs,
  toTemplateEventDetailsVariable
} from "../utils/whatsappInviteCopy.js";
import { getDefaultWelcomeParagraph, isConferenceEventType } from "../utils/eventTypeWording.js";
import { recalculateUserSupplierCost } from "../utils/supplierCost.js";

/**
 * Template SID routing for bulk invite send.
 * Conference ALWAYS wins; otherwise use event.whatsappInviteTemplate (with legacy boolean fallback).
 */
function resolveInviteContentRouting(event) {
  const eventType = event?.eventType ?? null;
  const conference = isConferenceEventType(eventType);

  if (conference) {
    const envRaw = String(process.env.TWILIO_CONFERENCE_RSVP_CONTENT_SID || "").trim();
    const fromEnv = envRaw.startsWith("HX");
    return {
      eventType,
      templateId: "conference",
      premiumButtonsEnabled: false,
      premiumCardEnabled: false,
      conference: true,
      contentSid: fromEnv ? envRaw : CONFERENCE_RSVP_CONTENT_SID_DEFAULT,
      sidSource: fromEnv
        ? "env:TWILIO_CONFERENCE_RSVP_CONTENT_SID"
        : "default:CONFERENCE_RSVP_CONTENT_SID_DEFAULT",
      templateKeys: ["1"],
      fieldKeyMap: { guestName: "1" },
      requiresCoverMedia: false,
      includesRsvpLink: false,
      buttonsAffectsRouting: false
    };
  }

  const invite = resolveInviteTemplateRouting(event);
  return {
    eventType,
    templateId: invite.templateId,
    premiumButtonsEnabled: invite.premiumButtonsEnabled,
    premiumCardEnabled: invite.premiumCardEnabled,
    conference: false,
    contentSid: invite.contentSid,
    sidSource: invite.sidSource,
    templateKeys: invite.templateKeys,
    fieldKeyMap: getTemplateFieldKeyMap(invite.templateId),
    requiresCoverMedia: invite.requiresCoverMedia,
    includesRsvpLink: invite.includesRsvpLink,
    buttonsAffectsRouting: true
  };
}

function logInviteTemplateRouting(routing) {
  console.log(
    `[Twilio][template-routing] eventType=${JSON.stringify(routing.eventType)} ` +
      `templateId=${routing.templateId} ` +
      `premiumButtons=${routing.premiumButtonsEnabled} ` +
      `premiumCard=${routing.premiumCardEnabled} ` +
      `conference=${routing.conference} ` +
      `selectedSid=${routing.contentSid} ` +
      `sidSource=${routing.sidSource} ` +
      `variables=${routing.templateKeys.join(",")} ` +
      `requiresCover=${routing.requiresCoverMedia} ` +
      `includesRsvpLink=${routing.includesRsvpLink}`
  );
  if (routing.conference) {
    console.log(
      "[Twilio][template-routing] NOTE: Admin WhatsApp template selection ignored — " +
        "כנס always uses conference Card SID."
    );
  }
}

function normalizePaymentCode(rawCode) {
  return String(rawCode || "").trim().toUpperCase();
}

function buildInsufficientCreditsMessage(codeRecord) {
  return `קנית מכסה בסך של ${codeRecord.total_credits} הודעות. נשארו לך ${codeRecord.remaining_credits} הודעות לניצול. מצטערים, נא לנסות שוב עם בחירה של עד ${codeRecord.remaining_credits} מוזמנים.`;
}

function isTwilioFromAddressError(error) {
  const code = Number(error?.code);
  const message = String(error?.message || "");
  return code === 63007 || message.includes("Channel with the specified From");
}

export function mapTwilioErrorMessage(error) {
  if (isTwilioFromAddressError(error)) {
    return "שליחת ההודעה נכשלה, נא לוודא שמספר המערכת מוגדר כראוי";
  }
  if (Number(error?.code) === 21656 || Number(error?.code) === 63028) {
    return "שליחת ההודעה נכשלה: מספר משתני התבנית אינו תואם. לתבנית כנס יש לשלוח רק {{1}} (שם המשתתף).";
  }
  return error?.message || "שליחת ההודעה נכשלה, אנא נסה שוב מאוחר יותר";
}

export async function findValidActivationCode(paymentCode) {
  const code = String(paymentCode || "").trim().toUpperCase();
  if (!code) return { error: "missing_code" };

  const codeRecord = await ActivationCode.findOne({ code, isActive: true });
  if (!codeRecord) {
    return { error: "invalid_code" };
  }

  if (codeRecord.expiresAt && codeRecord.expiresAt.getTime() < Date.now()) {
    return { error: "expired_code", codeRecord };
  }

  return { codeRecord };
}

export async function reserveActivationCredits(codeRecord, requestedCount) {
  const reserved = await ActivationCode.findOneAndUpdate(
    {
      _id: codeRecord._id,
      isActive: true,
      remaining_credits: { $gte: requestedCount }
    },
    { $inc: { remaining_credits: -requestedCount } },
    { new: true }
  );

  if (!reserved) {
    const fresh = await ActivationCode.findById(codeRecord._id);
    return {
      ok: false,
      message: `קנית מכסה בסך של ${(fresh || codeRecord).total_credits} הודעות. נשארו לך ${(fresh || codeRecord).remaining_credits} הודעות לניצול.`
    };
  }

  return { ok: true, codeRecord: reserved };
}

export async function releaseActivationCredits(codeId, count) {
  if (!codeId || !count) return;
  try {
    await ActivationCode.findByIdAndUpdate(codeId, { $inc: { remaining_credits: count } });
  } catch (releaseError) {
    console.error("[Twilio] Failed to release credits:", releaseError?.message || releaseError);
  }
}

async function findValidCodeRecord(paymentCode) {
  return findValidActivationCode(paymentCode);
}

async function reserveCredits(codeRecord, requestedCount) {
  return reserveActivationCredits(codeRecord, requestedCount);
}

async function releaseCredits(codeId, count) {
  return releaseActivationCredits(codeId, count);
}

function resolveInviteeTemplateFields({ invitee, defaults, eventId, origin, paragraphs }) {
  const rsvpLink = buildPublicEventLink({ eventId, origin }) || String(defaults?.rsvpLink || "").trim();
  const guestName = String(invitee.name || "אורח/ת יקר/ה").trim();

  const customOpeningText =
    String(paragraphs?.welcomeParagraph || "").trim() ||
    String(defaults?.intro || "").trim() ||
    getDefaultWelcomeParagraph();

  const eventDateTimeLocation = toTemplateEventDetailsVariable(
    String(paragraphs?.eventDetailsParagraph || "").trim() ||
      String(defaults?.eventDetails || "").trim() ||
      "פרטי האירוע יתעדכנו בקרוב"
  );

  const closingSignOff =
    String(paragraphs?.closingParagraph || "").trim() ||
    String(defaults?.signature || "").trim() ||
    "נתראה בשמחה";

  return {
    guestName,
    customOpeningText,
    eventDateTimeLocation,
    rsvpLink,
    closingSignOff
  };
}

async function sendToInvitee({
  invitee,
  eventId,
  origin,
  contentSid,
  defaults,
  templateKeys,
  fieldKeyMap,
  includesRsvpLink = true,
  userId,
  paragraphs,
  event,
  conferenceMode = false,
  mediaVariableMode = "path"
}) {
  const to = toTwilioWhatsAppAddress(invitee.phone);
  if (!to) {
    console.error(
      `ERROR: שליחת וואטסאפ נכשלה למספר ${invitee.phone || "לא ידוע"} מאת משתמש ${userId || "לא ידוע"}. סיבה: מספר טלפון לא תקין`
    );
    return {
      ok: false,
      invitee,
      error: { message: `מספר טלפון לא תקין עבור ${invitee.name}` }
    };
  }

  try {
    if (conferenceMode || isConferenceContentSid(contentSid)) {
      const guestName = invitee.name || invitee.fullName || "משקיע/ה יקר/ה";
      console.log(
        `[Twilio][diag-63028][invitee] path=sendConferenceInviteWhatsApp ` +
          `name=${guestName} phone=${invitee.phone} conferenceMode=${conferenceMode} ` +
          `passedContentSid=${contentSid} resolvedConferenceSid=${resolveConferenceContentSid()}`
      );
      const created = await sendConferenceInviteWhatsApp({
        to,
        guestName,
        userId: userId || eventId,
        recipientPhone: invitee.phone,
        guestId: invitee.guestId
      });
      console.log(
        `[Twilio][diag-63028][invitee] CREATE_RESULT messageSid=${created?.sid || "?"} ` +
          `status=${created?.status || "?"} errorCode=${created?.errorCode ?? "(none)"} ` +
          `→ correlate this Message SID in Twilio Console for Warning 63028`
      );
      return { ok: true, invitee, messageSid: created?.sid || null };
    }

    const fields = resolveInviteeTemplateFields({
      invitee,
      defaults,
      eventId,
      origin,
      paragraphs
    });

    if (includesRsvpLink && !fields.rsvpLink) {
      throw new Error("RSVP link is missing");
    }

    const mediaFieldKey = fieldKeyMap?.mediaPath;
    const needsMedia = Boolean(mediaFieldKey && templateKeys.includes(String(mediaFieldKey)));
    const needsSpecialRequests = Boolean(fieldKeyMap?.specialRequestsLink);
    const needsWazeLink = Boolean(fieldKeyMap?.wazeLink);
    const needsWazeQuery = Boolean(fieldKeyMap?.wazeQuery);
    const needsInviteButtonPath = Boolean(fieldKeyMap?.inviteButtonPath);
    const specialRequestsLink = needsSpecialRequests ? fields.rsvpLink : undefined;
    const wazeLink = needsWazeLink ? buildWazeNavigationLink(event) : undefined;
    const wazeQuery = needsWazeQuery ? buildWazeQueryVariable(event) : undefined;
    const inviteButtonPath = needsInviteButtonPath
      ? buildInviteUrlButtonVariable(fields.rsvpLink)
      : undefined;

    if (needsSpecialRequests && !specialRequestsLink) {
      throw new Error("קישור לאלרגיות/הסעות חסר (עמוד ההזמנה)");
    }
    if (needsWazeLink && !wazeLink) {
      throw new Error("לא ניתן לבנות קישור Waze — חסר כתובת/מיקום לאירוע");
    }
    if (needsWazeQuery && !wazeQuery) {
      throw new Error("לא ניתן לבנות ניווט Waze — חסר שם מתחם/כתובת לאירוע");
    }
    if (needsInviteButtonPath && !inviteButtonPath) {
      throw new Error("לא ניתן לבנות כפתור ההפניה — חסר קישור לעמוד ההזמנה");
    }

    const contentVariables = buildTwilioContentVariables(
      {
        guestName: fields.guestName,
        customOpeningText: fields.customOpeningText,
        eventDateTimeLocation: fields.eventDateTimeLocation,
        rsvpLink: fields.rsvpLink,
        closingSignOff: fields.closingSignOff,
        mediaPath: needsMedia
          ? toWhatsAppCoverMediaVariable(resolveEventCoverMediaPath(event), mediaVariableMode)
          : undefined,
        specialRequestsLink,
        wazeLink,
        wazeQuery,
        inviteButtonPath
      },
      templateKeys,
      fieldKeyMap
    );

    const created = await sendTwilioWhatsAppMessage({
      to,
      contentSid,
      contentVariables,
      userId: userId || eventId,
      recipientPhone: invitee.phone,
      guestId: invitee.guestId,
      guestName: invitee.name
    });
    return { ok: true, invitee, messageSid: created?.sid || null };
  } catch (error) {
    try {
      console.error("[Twilio] template keys:", templateKeys?.join(", ") || "unknown");
      console.error("[Twilio] contentSid:", contentSid);
      console.error("[Twilio] conferenceMode:", conferenceMode);
      console.error(
        "[Twilio] contentVariables payload:",
        conferenceMode || isConferenceContentSid(contentSid)
          ? buildConferenceContentVariables(invitee.name || invitee.fullName || "משקיע/ה יקר/ה")
          : "(non-conference)"
      );
    } catch {
      /* ignore debug logging errors */
    }
    return { ok: false, invitee, error };
  }
}

export async function sendBulkWhatsApp({
  paymentCode,
  guests,
  event,
  userId,
  origin
}) {
  try {
    if (!isTwilioConfigured()) {
      return {
        status: 503,
        body: {
          success: false,
          message: "שירות שליחת וואטסאפ לא מוגדר בשרת. פנו למנהל המערכת."
        }
      };
    }

    if (!Array.isArray(guests) || guests.length === 0) {
      return { status: 400, body: { success: false, message: "יש לבחור לפחות מוזמן אחד לשליחה" } };
    }

    const { codeRecord, error: codeError } = await findValidCodeRecord(paymentCode);
    if (codeError === "missing_code") {
      return { status: 400, body: { success: false, message: "יש להזין קוד רכישה" } };
    }
    if (codeError === "invalid_code") {
      return { status: 404, body: { success: false, message: "קוד לא תקין, אנא בדוק שוב." } };
    }
    if (codeError === "expired_code") {
      return { status: 400, body: { success: false, message: "קוד הרכישה פג תוקף. פנו למנהל המערכת." } };
    }

    const namedGuests = guests
      .map((guest) => ({
        guestId: guest._id,
        name: String(guest.fullName || "").trim(),
        phone: String(guest.phone || "").trim()
      }))
      .filter((guest) => guest.name);

    const skippedNoPhone = namedGuests
      .filter((guest) => !guest.phone)
      .map((guest) => ({ guestId: guest.guestId, name: guest.name }));

    const invitees = namedGuests.filter((guest) => guest.phone);

    if (!invitees.length) {
      return {
        status: 400,
        body: {
          success: false,
          message:
            skippedNoPhone.length > 0
              ? "לא נשלחו הודעות — לכל המוזמנים שנבחרו חסר מספר טלפון"
              : "לא נמצאו מוזמנים תקינים לשליחה",
          sentCount: 0,
          failedCount: 0,
          skippedNoPhoneCount: skippedNoPhone.length,
          skippedNoPhone
        }
      };
    }

    const requestedCount = invitees.length;
    const routing = resolveInviteContentRouting(event);
    logInviteTemplateRouting(routing);
    logTwilioContentSidEnvSnapshot("bulk-send");

    if (routing.requiresCoverMedia && !resolveEventCoverMediaPath(event)) {
      return {
        status: 400,
        body: {
          success: false,
          message:
            "לתבנית וואטסאפ עם תמונה חובה להעלות תמונת כיסוי לאירוע לפני השליחה. העלו תמונה בהגדרות האירוע ונסו שוב."
        }
      };
    }

    const reservation = await reserveCredits(codeRecord, requestedCount);
    if (!reservation.ok) {
      return { status: 400, body: { success: false, message: reservation.message } };
    }

    const reservedRecord = reservation.codeRecord;
    const defaults = buildWhatsAppTemplateDefaults({
      event,
      eventId: userId,
      origin
    });
    const paragraphs = resolveWhatsAppInviteParagraphs(event);
    const conferenceMode = routing.conference;
    const contentSid = routing.contentSid;
    let templateKeys = routing.templateKeys;
    let fieldKeyMap = routing.fieldKeyMap;
    let mediaVariableMode = "path";
    const includesRsvpLink = routing.includesRsvpLink !== false;

    console.log(
      `[Twilio][diag-63028][bulk-send] userId=${userId || "?"} ` +
        `eventTypeRaw=${JSON.stringify(event?.eventType)} ` +
        `templateId=${routing.templateId} ` +
        `isConference=${conferenceMode} ` +
        `selectedSid=${contentSid} sidSource=${routing.sidSource} ` +
        `expectedKeys=[${templateKeys.join(",")}] ` +
        `inviteeCount=${invitees.length}`
    );

    if (conferenceMode) {
      console.log(
        `[Twilio] Conference Card template locked to SID=${contentSid} variables=1 only (static media in template)`
      );
      await logTwilioContentApprovalDiagnostics(contentSid, "bulk-send-conference");
    } else {
      try {
        const templateMeta = await fetchTwilioContentTemplate(contentSid);
        const shape = templateMeta.shape || {};
        console.log(
          `[Twilio][card-shape] template=${routing.templateId} friendly=${templateMeta.friendlyName} ` +
            `media=${JSON.stringify(shape.media || [])} buttons=${JSON.stringify(shape.buttons || [])} ` +
            `bodyKeys=${(shape.bodyKeys || []).join(",") || "-"} ` +
            `snippets=${JSON.stringify(shape.snippets || [])}`
        );
        console.log(
          `[Twilio] Using template "${templateMeta.friendlyName}" (${contentSid}) ` +
            `registry=${routing.templateId} variables: ${templateKeys.join(", ")}`
        );
      } catch (templateError) {
        console.warn(
          `[Twilio] Could not fetch content template metadata, using default keys ${templateKeys.join(", ")}:`,
          templateError?.message || templateError
        );
      }
    }

    const results = await Promise.all(
      invitees.map((invitee) =>
        sendToInvitee({
          invitee,
          eventId: userId,
          origin,
          contentSid,
          defaults,
          templateKeys,
          fieldKeyMap,
          includesRsvpLink,
          userId,
          paragraphs,
          event,
          conferenceMode,
          mediaVariableMode
        })
      )
    );
    const sentResults = results.filter((result) => result.ok);
    const failedResults = results.filter((result) => !result.ok);
    const sentCount = sentResults.length;
    const failedCount = failedResults.length;

    if (failedCount > 0) {
      await releaseCredits(reservedRecord._id, failedCount);
    }

    if (sentCount > 0) {
      const sentGuestIds = sentResults
        .map((result) => result.invitee?.guestId)
        .filter(Boolean);
      if (sentGuestIds.length) {
        try {
          await Guest.updateMany(
            { _id: { $in: sentGuestIds } },
            {
              $inc: {
                reminderRound: 1,
                whatsappRoundsSentCount: 1
              },
              $set: {
                whatsappConversationState: "idle",
                lastWhatsAppSentAt: new Date()
              }
            }
          );
        } catch (roundError) {
          console.error("[Twilio] Failed to increment reminderRound:", roundError?.message || roundError);
        }
      }
    }

    if (sentCount === 0) {
      const primaryError = failedResults.find((result) => result.error)?.error;
      const status = isTwilioFromAddressError(primaryError) ? 400 : 500;
      return {
        status,
        body: {
          success: false,
          message: mapTwilioErrorMessage(primaryError),
          sentCount: 0,
          failedCount,
          skippedNoPhoneCount: skippedNoPhone.length,
          skippedNoPhone,
          twilioCode: primaryError?.code || null
        }
      };
    }

    if (!reservedRecord.redeemedByUserId) {
      try {
        reservedRecord.redeemedByUserId = userId;
        await reservedRecord.save();
        await recalculateUserSupplierCost(userId);
      } catch (saveError) {
        console.error("[Twilio] Failed to mark code as redeemed:", saveError?.message || saveError);
      }
    }

    const freshRecord = await ActivationCode.findById(reservedRecord._id);
    const remaining = freshRecord?.remaining_credits ?? reservedRecord.remaining_credits;
    const skippedSuffix =
      skippedNoPhone.length > 0
        ? ` ${skippedNoPhone.length} מוזמנים דולגו כי חסר מספר טלפון.`
        : "";

    if (failedCount > 0) {
      return {
        status: 207,
        body: {
          success: true,
          partial: true,
          message: `נשלחו ${sentCount} הודעות. ${failedCount} נכשלו. נשארו ${remaining} הודעות במכסה.${skippedSuffix}`,
          sentCount,
          failedCount,
          remaining,
          skippedNoPhoneCount: skippedNoPhone.length,
          skippedNoPhone
        }
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        message: `מצויין! נשלחו ${sentCount} הודעות. נשאר לך עוד ${remaining} הודעות במכסה.${skippedSuffix}`,
        sentCount,
        remaining,
        skippedNoPhoneCount: skippedNoPhone.length,
        skippedNoPhone
      }
    };
  } catch (unexpectedError) {
    console.error("[Twilio] Unexpected bulk send error:", unexpectedError?.message || unexpectedError);
    return {
      status: 500,
      body: {
        success: false,
        message: "שגיאה פנימית בשליחת ההודעות, אנא נסה שוב מאוחר יותר."
      }
    };
  }
}
