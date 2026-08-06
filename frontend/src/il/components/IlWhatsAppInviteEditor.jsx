import { useEffect, useRef } from "react";
import {
  DEFAULT_CLOSING_PLACEHOLDER,
  DEFAULT_EVENT_DETAILS_PLACEHOLDER,
  DEFAULT_WELCOME_PLACEHOLDER,
  getRsvpLinkPrompt
} from "../../utils/whatsappInviteCopy.js";
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
 * Inline WhatsApp-bubble invitation editor matching the approved Facebook template order.
 */
export default function IlWhatsAppInviteEditor({
  eventId,
  origin,
  value,
  onChange,
  buttonsMode = false
}) {
  const welcome = value?.welcomeParagraph ?? "";
  const eventDetails = value?.eventDetailsParagraph ?? "";
  const closing = value?.closingParagraph ?? "";
  const linkPrompt = getRsvpLinkPrompt(buttonsMode);

  const publicLink = `${String(origin || "").replace(/\/$/, "")}/event/${eventId}`;

  const patch = (key, nextValue) => {
    onChange?.({
      welcomeParagraph: welcome,
      eventDetailsParagraph: eventDetails,
      closingParagraph: closing,
      [key]: nextValue
    });
  };

  return (
    <div className="il-wa-phone" dir="rtl">
      <div className="il-wa-phone-chrome" aria-hidden="true">
        <span className="il-wa-phone-dot" />
        <span className="il-wa-phone-title">תצוגת הודעה</span>
      </div>
      <div className="il-wa-chat">
        <div className="il-wa-bubble" role="group" aria-label="עריכת הודעת הזמנה בוואטסאפ">
          <p className="il-wa-locked il-wa-emoji-row">✨ 🥂 ✨</p>
          <p className="il-wa-locked">
            שלום <span className="il-wa-token">[שם האורח]</span>,
          </p>

          <AutoGrowField
            id="wa-welcome-paragraph"
            value={welcome}
            onChange={(next) => patch("welcomeParagraph", next)}
            placeholder={DEFAULT_WELCOME_PLACEHOLDER}
            aria-label="פסקת פתיחה"
          />

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

          <p className="il-wa-locked" key={buttonsMode ? "buttons" : "standard"}>
            {linkPrompt}
          </p>
          <p className="il-wa-locked il-wa-link">{publicLink}</p>

          <AutoGrowField
            id="wa-closing-paragraph"
            value={closing}
            onChange={(next) => patch("closingParagraph", next)}
            placeholder={DEFAULT_CLOSING_PLACEHOLDER}
            aria-label="סיום וחתימה"
          />

          <p className="il-wa-locked il-wa-emoji-row">✨ 🎉 ✨</p>

          {buttonsMode ? (
            <div className="il-wa-quick-replies" aria-hidden="true">
              <span>כן אני אגיע</span>
              <span>לצערי לא אוכל</span>
              <span>עדיין לא יודע</span>
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
      <p className="il-wa-hint">השדות הבהירים ניתנים לעריכה.</p>
    </div>
  );
}
