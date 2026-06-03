import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import gigBackground from "../../GIG.gif";
import babyBackground from "../../BABY.gif";
import { formatIsraeliDate, formatIsraeliWeekday } from "../utils/dateFormat";

const STATUS_OPTIONS = [
  { value: "מגיע", label: "אגיע", stateClass: "status-btn--yes" },
  { value: "לא מגיע", label: "לא אגיע", stateClass: "status-btn--no" },
  { value: "אולי", label: "אולי אגיע...", stateClass: "status-btn--maybe" }
];

function attendeesCountForStatus(status, currentCount) {
  if (status === "מגיע") return Math.max(1, Number(currentCount) || 1);
  if (status === "לא מגיע") return 0;
  if (status === "אולי") return 1;
  return currentCount;
}

const initialRsvp = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "מגיע"
};

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

export default function EventPage() {
  const { eventId } = useParams();
  const [eventData, setEventData] = useState(null);
  const [form, setForm] = useState(initialRsvp);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get(`/public/event/${eventId}`)
      .then((response) => setEventData(response.data))
      .catch(() => setError("לא ניתן לטעון את פרטי האירוע"))
      .finally(() => setLoading(false));
  }, [eventId]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" ? Number(value) : value
    }));
  };

  const setStatus = (status) => {
    setForm((prev) => ({
      ...prev,
      status,
      attendeesCount: attendeesCountForStatus(status, prev.attendeesCount)
    }));
  };

  const isAttending = form.status === "מגיע";

  const increaseAttendees = () => {
    setForm((prev) => ({ ...prev, attendeesCount: Math.min(20, Number(prev.attendeesCount || 0) + 1) }));
  };

  const decreaseAttendees = () => {
    setForm((prev) => ({ ...prev, attendeesCount: Math.max(1, Number(prev.attendeesCount || 1) - 1) }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        attendeesCount: attendeesCountForStatus(form.status, form.attendeesCount)
      };
      await api.post(`/public/event/${eventId}/rsvp`, payload);
      setMessage("תודה! האישור נשמר בהצלחה");
      setForm(initialRsvp);
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      setError(serverMessage || "שליחת הטופס נכשלה. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  const event = eventData?.event;
  const pageBackgroundGif = getPageBackgroundGif(event);

  if (loading) {
    return (
      <div className="invite-page">
        <InvitePageBackdrop backgroundSrc={gigBackground} />
        <div className="invite-loading">
          <p>טוען את פרטי האירוע…</p>
        </div>
      </div>
    );
  }

  if (error && !eventData) {
    return (
      <div className="invite-page">
        <InvitePageBackdrop backgroundSrc={gigBackground} />
        <div className="invite-error-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const isBrit = event?.eventType === "ברית";
  const eventDateText = event?.eventDate ? formatIsraeliDate(event.eventDate) : "";
  const eventTimeText = event?.eventTime ? String(event.eventTime) : "";
  const hasCoverImage = Boolean(event?.imageDataUrl?.trim());
  const heroCoverStyle = hasCoverImage ? { backgroundImage: `url(${event.imageDataUrl})` } : undefined;
  const closingText = getEventClosing(event);

  return (
    <div className="invite-page">
      <InvitePageBackdrop backgroundSrc={pageBackgroundGif} />
      <div className="invite-shell">
        {event ? (
          <>
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
                    {eventDateText && !isBrit ? <p className="invite-hero-date invite-num">{eventDateText}</p> : null}
                  </>
                ) : null}
              </div>

              <div className="invite-details centered">
                {event.eventType === "חתונה" ? (
                  <div className="invite-headline">
                    <p className="invite-headline-intro">הנכם מוזמנים לחתונה</p>
                    <h1 className="invite-headline-names">
                      {event.groomName} & {event.brideName}
                    </h1>
                  </div>
                ) : event.eventType === "ברית" ? (
                  <BritInviteDetails event={event} />
                ) : (
                  <div className="invite-headline">
                    <p className="invite-headline-intro">
                      הנכם מוזמנים לאירוע{event.eventType && event.eventType !== "אחר" ? ` ${event.eventType}` : ""}
                    </p>
                    {event.eventNames ? (
                      <h1 className="invite-headline-names">{event.eventNames}</h1>
                    ) : null}
                  </div>
                )}
                {event.eventType !== "ברית" ? (
                  <>
                    <p className="invite-detail-value invite-num">{eventDateText}</p>
                    <p className="invite-detail-value">{event.venueName}</p>
                    <p className="invite-detail-label">
                      {event.streetAndNumber}, {event.city}
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
          </>
        ) : null}

        <form className="invite-form-section" onSubmit={onSubmit} noValidate>
          {message ? (
            <div className="invite-success">
              <div className="success-check" aria-hidden="true">
                ✓
              </div>
              <h2>נשמח לארח אתכם!</h2>
              <p>האישור נקלט בהצלחה. תודה שהקדשתם רגע לעדכן אותנו.</p>
            </div>
          ) : (
            <>
              <div className="invite-form-heading">
                <h2>אשרו את הגעתכם</h2>
                <p>נשמח לדעת שתוכלו לחגוג איתנו את הרגע המיוחד</p>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="fullName">
                  שם מלא
                </label>
                <input
                  id="fullName"
                  className="field-input"
                  name="fullName"
                  placeholder="הזינו שם מלא"
                  value={form.fullName}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="phone">
                  טלפון
                </label>
                <input
                  id="phone"
                  className="field-input invite-num"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  placeholder="050-0000000"
                  value={form.phone}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="field">
                <span className="field-label">סטטוס הגעה</span>
                <div className="status-group status-group--horizontal" role="group" aria-label="סטטוס הגעה">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn status-btn ${option.stateClass} ${
                        form.status === option.value ? "is-selected" : ""
                      }`}
                      onClick={() => setStatus(option.value)}
                      aria-pressed={form.status === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {isAttending ? (
                <div className="field attendees-field">
                  <div className="attendees-header">
                    <span className="field-label">כמה מגיעים?</span>
                  </div>
                  <div className="attendees-stepper">
                    <button className="btn stepper-btn" type="button" onClick={increaseAttendees} aria-label="הגדלת כמות">
                      +
                    </button>
                    <input
                      id="attendeesCount"
                    className="field-input attendees-input invite-num"
                    name="attendeesCount"
                    type="number"
                      min="1"
                      value={form.attendeesCount}
                      onChange={onChange}
                      required
                    />
                    <button className="btn stepper-btn" type="button" onClick={decreaseAttendees} aria-label="הקטנת כמות">
                      -
                    </button>
                  </div>
                </div>
              ) : null}

              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>
                {submitting ? "שולח…" : "אישור הגעה"}
              </button>

              <p className="invite-closing">{closingText}</p>
            </>
          )}

          {error && eventData ? <p className="message message--error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
