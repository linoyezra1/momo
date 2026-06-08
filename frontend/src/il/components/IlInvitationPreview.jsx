import "../../styles.css";
import gigBackground from "../../../GIG.gif";
import babyBackground from "../../../BABY.gif";
import { formatIsraeliDate, formatIsraeliWeekday } from "../../utils/dateFormat";

function getEventClosing(event) {
  if (!event) return "נשמח לראותכם בין אורחינו…";
  if (event.eventType === "חתונה") {
    return `נשמח לראותכם בין אורחינו, ${event.groomName || ""} ו${event.brideName || ""}`.trim();
  }
  if (event.eventType === "ברית") {
    return `נשמח לראותכם בין אורחינו, ${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim();
  }
  if (event.eventNames) {
    return `נשמח לראותכם בין אורחינו, ${event.eventNames}`.trim();
  }
  return "נשמח לראותכם בין אורחינו…";
}

function getPageBackgroundGif(event) {
  if (event?.eventType === "ברית") return babyBackground;
  return gigBackground;
}

function InvitePageBackdrop({ backgroundSrc }) {
  return (
    <>
      <img className="invite-bg-gif" src={backgroundSrc} alt="" aria-hidden="true" />
      <div className="invite-bg-overlay" />
    </>
  );
}

function BritInviteDetails({ event }) {
  const weekday = event?.eventDate ? formatIsraeliWeekday(event.eventDate) : "";
  const hebrewDate = event?.eventDateHebrew?.trim() || "";
  const dateDots = event?.eventDate ? formatIsraeliDate(event.eventDate) : "";
  const venue = event?.venueName?.trim() || "";
  const street = event?.streetAndNumber?.trim() || "";
  const city = event?.city?.trim() || "";
  const time = event?.eventTime ? String(event.eventTime).trim() : "";
  const whenLineParts = [weekday, hebrewDate].filter(Boolean);
  const addressLine = [street, city].filter(Boolean).join(", ");

  return (
    <div className="invite-brit-details" dir="rtl">
      <p className="invite-brit-line">שמחים להזמינכם לחגוג עמנו</p>
      <p className="invite-brit-line">את ברית המילה של בננו שתתקיים</p>
      {whenLineParts.length > 0 ? (
        <p className="invite-brit-line invite-brit-when">ב{whenLineParts.join(" ")}</p>
      ) : null}
      {dateDots ? <p className="invite-brit-date invite-num">{dateDots}</p> : null}
      {venue ? <p className="invite-brit-line invite-brit-venue">{venue}</p> : null}
      {addressLine ? <p className="invite-brit-line invite-num">{addressLine}</p> : null}
      {time ? (
        <p className="invite-brit-line invite-brit-time">
          בשעה <span className="invite-num">{time}</span>
        </p>
      ) : null}
    </div>
  );
}

function BatMitzvahInviteDetails({ event }) {
  const name = event?.batMitzvahName?.trim() || "";
  return (
    <div className="invite-headline">
      <p className="invite-headline-intro">אנו נרגשים להזמינכם לחגיגת בת המצווה של בתנו</p>
      <h1 className="invite-headline-names">{name || "—"}</h1>
    </div>
  );
}

export default function IlInvitationPreview({ event }) {
  const pageBackgroundGif = getPageBackgroundGif(event);
  const isBrit = event?.eventType === "ברית";
  const eventDateText = event?.eventDate ? formatIsraeliDate(event.eventDate) : "";
  const eventTimeText = event?.eventTime ? String(event.eventTime) : "";
  const hasCoverImage = Boolean(event?.imageDataUrl?.trim());
  const heroCoverStyle = hasCoverImage ? { backgroundImage: `url(${event.imageDataUrl})` } : undefined;
  const closingText = getEventClosing(event);

  return (
    <div className="invite-page il-invite-preview" dir="rtl">
      <InvitePageBackdrop backgroundSrc={pageBackgroundGif} />
      <div className="invite-shell">
        <header className="invite-hero">
          <div
            className={`invite-hero-media${hasCoverImage ? "" : " invite-hero-media--plain"}`}
            style={heroCoverStyle}
            aria-hidden="true"
          >
            {hasCoverImage ? (
              <>
                <div className="invite-hero-overlay" />
                <div className="invite-hero-content" />
              </>
            ) : null}
            {eventDateText && !isBrit ? <p className="invite-hero-date invite-num">{eventDateText}</p> : null}
          </div>

          <div className="invite-details centered">
            {event?.eventType === "חתונה" ? (
              <div className="invite-headline">
                <p className="invite-headline-intro">הנכם מוזמנים לחתונה</p>
                <h1 className="invite-headline-names">
                  {event.groomName || "—"} & {event.brideName || "—"}
                </h1>
              </div>
            ) : event?.eventType === "ברית" ? (
              <BritInviteDetails event={event} />
            ) : event?.eventType === "בת מצווה" ? (
              <BatMitzvahInviteDetails event={event} />
            ) : (
              <div className="invite-headline">
                <p className="invite-headline-intro">
                  הנכם מוזמנים לאירוע{event?.eventType && event.eventType !== "אחר" ? ` ${event.eventType}` : ""}
                </p>
                {event?.eventNames ? <h1 className="invite-headline-names">{event.eventNames}</h1> : null}
              </div>
            )}
            {event?.eventType !== "ברית" ? (
              <>
                <p className="invite-detail-value invite-num">{eventDateText || "—"}</p>
                <p className="invite-detail-value">{event?.venueName || "—"}</p>
                <p className="invite-detail-label">
                  {event?.streetAndNumber || "—"}, {event?.city || "—"}
                </p>
                {eventTimeText ? (
                  <p className="invite-detail-label">
                    בשעה <span className="invite-num">{eventTimeText}</span>
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </header>

        <hr className="divider" />

        <div className="invite-form-section il-invite-preview__rsvp" aria-hidden="true">
          <div className="invite-form-heading">
            <h2>אשרו את הגעתכם</h2>
            <p>נשמח לדעת שתוכלו לחגוג איתנו את הרגע המיוחד</p>
          </div>
          <div className="field">
            <span className="field-label">שם מלא</span>
            <div className="field-input il-preview-placeholder">הזינו שם מלא</div>
          </div>
          <div className="field">
            <span className="field-label">טלפון</span>
            <div className="field-input invite-num il-preview-placeholder" dir="ltr">
              050-0000000
            </div>
          </div>
          <div className="field">
            <span className="field-label">סטטוס הגעה</span>
            <div className="status-group status-group--horizontal">
              <span className="btn status-btn status-btn--yes is-selected">אגיע</span>
              <span className="btn status-btn status-btn--no">לא אגיע</span>
              <span className="btn status-btn status-btn--maybe">אולי אגיע...</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" type="button" disabled>
            אישור הגעה
          </button>
          <p className="invite-closing">{closingText}</p>
        </div>
      </div>
    </div>
  );
}
