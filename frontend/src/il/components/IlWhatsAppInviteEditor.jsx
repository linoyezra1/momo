import { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_CLOSING_PLACEHOLDER,
  DEFAULT_EVENT_DETAILS_PLACEHOLDER,
  DEFAULT_WELCOME_PLACEHOLDER,
  getRsvpLinkPrompt
} from "../../utils/whatsappInviteCopy.js";
import {
  getWhatsAppInvitePreviewShape,
  resolveEventWhatsAppInviteTemplateId
} from "../../utils/whatsappInviteTemplates.js";
import "./il-whatsapp-invite-editor.css";

function AutoGrowField({
  id,
  value,
  onChange,
  placeholder,
  singleLine = false,
  "aria-label": ariaLabel
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, singleLine ? 24 : 40)}px`;
  }, [value, singleLine]);

  return (
    <textarea
      ref={ref}
      id={id}
      className="il-wa-bubble-field"
      rows={singleLine ? 1 : 2}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={
        singleLine
          ? (event) => {
              if (event.key === "Enter") event.preventDefault();
            }
          : undefined
      }
    />
  );
}

/**
 * Inline WhatsApp-bubble invitation editor.
 * Preview layout follows the client's Twilio Content template (variables + buttons).
 */
export default function IlWhatsAppInviteEditor({
  eventId,
  origin,
  value,
  onChange,
  event = null,
  templateId: templateIdProp = "",
  conferenceMode = false
}) {
  const welcome = value?.welcomeParagraph ?? "";
  const eventDetails = value?.eventDetailsParagraph ?? "";
  const closing = value?.closingParagraph ?? "";

  const templateId = useMemo(() => {
    const explicit = String(templateIdProp || "").trim();
    if (explicit) return explicit;
    return resolveEventWhatsAppInviteTemplateId(event || {});
  }, [templateIdProp, event]);

  const shape = useMemo(() => getWhatsAppInvitePreviewShape(templateId), [templateId]);

  const publicLink = `${String(origin || "").replace(/\/$/, "")}/event/${eventId}`;
  const rsvpPrompt = getRsvpLinkPrompt(true);

  const patch = (key, nextValue) => {
    onChange?.({
      welcomeParagraph: welcome,
      eventDetailsParagraph: eventDetails,
      closingParagraph: closing,
      [key]: nextValue
    });
  };

  if (conferenceMode) {
    return (
      <div className="il-wa-phone" dir="rtl">
        <div className="il-wa-phone-chrome" aria-hidden="true">
          <span className="il-wa-phone-dot" />
          <span className="il-wa-phone-title">תצוגת הודעה</span>
        </div>
        <div className="il-wa-chat">
          <div className="il-wa-bubble" role="group" aria-label="הודעת הזמנה לכנס בוואטסאפ">
            <p className="il-wa-locked" style={{ fontWeight: 600 }}>
              כנס המשקיעים של ברק פיננסים
            </p>
            <p className="il-wa-locked">
              שלום <span className="il-wa-token">[שם המשתתף]</span>,
            </p>
            <p className="il-wa-locked">תוכן ההודעה והתמונה קבועים בתבנית המאושרת.</p>
            <div className="il-wa-quick-replies" aria-hidden="true">
              <span>כן, אני אגיע!</span>
              <span>לא אוכל להגיע</span>
            </div>
            <div className="il-wa-meta" aria-hidden="true">
              <span className="il-wa-time">עכשיו</span>
              <span className="il-wa-ticks" title="נשלח">
                ✓✓
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="il-wa-phone" dir="rtl">
      <div className="il-wa-phone-chrome" aria-hidden="true">
        <span className="il-wa-phone-dot" />
        <span className="il-wa-phone-title">תצוגת הודעה</span>
      </div>
      <div className="il-wa-chat">
        <div className="il-wa-bubble" role="group" aria-label="עריכת הודעת הזמנה בוואטסאפ">
          {shape.showMedia ? <div className="il-wa-media-placeholder" aria-hidden="true" /> : null}

          <p className="il-wa-locked il-wa-emoji-row">✨ 🥂 ✨</p>
          <p className="il-wa-locked">
            שלום <span className="il-wa-token">[שם האורח]</span>,
          </p>

          {shape.showOpening ? (
            <AutoGrowField
              id="wa-welcome-paragraph"
              value={welcome}
              onChange={(next) => patch("welcomeParagraph", next)}
              placeholder={DEFAULT_WELCOME_PLACEHOLDER}
              aria-label="פסקת פתיחה"
            />
          ) : null}

          {shape.showEventDetails ? (
            <div className="il-wa-inline-row il-wa-details-row">
              <span className="il-wa-locked">האירוע יתקיים ב</span>
              <AutoGrowField
                id="wa-event-details-paragraph"
                value={eventDetails}
                onChange={(next) => patch("eventDetailsParagraph", next)}
                placeholder={DEFAULT_EVENT_DETAILS_PLACEHOLDER}
                aria-label="פרטי מועד ומקום"
              />
            </div>
          ) : null}

          {shape.showRsvpLink ? (
            <>
              <p className="il-wa-locked">{rsvpPrompt}</p>
              <p className="il-wa-locked il-wa-link">{publicLink}</p>
            </>
          ) : null}

          {shape.showWazeInviteLine ? (
            <>
              <p className="il-wa-locked">לנוחיותכם, מצורף קישור ניווט ישיר ב-Waze לאולם:</p>
              <p className="il-wa-locked il-wa-link">https://waze.com/ul?q=…</p>
            </>
          ) : null}

          {shape.showClosing ? (
            <AutoGrowField
              id="wa-closing-paragraph"
              value={closing}
              onChange={(next) => patch("closingParagraph", next)}
              placeholder={DEFAULT_CLOSING_PLACEHOLDER}
              aria-label="סיום וחתימה"
            />
          ) : null}

          <p className="il-wa-locked il-wa-emoji-row">✨ 🎉 ✨</p>

          {shape.buttons.length ? (
            <div className="il-wa-quick-replies" aria-hidden="true">
              {shape.buttons.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          ) : null}

          <div className="il-wa-meta" aria-hidden="true">
            <span className="il-wa-time">עכשיו</span>
            <span className="il-wa-ticks" title="נשלח">
              ✓✓
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
