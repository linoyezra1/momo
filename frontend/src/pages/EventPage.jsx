import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { IconCity, IconDate, IconStreet, IconTime, IconVenue } from "../components/EventIcons.jsx";

const STATUS_OPTIONS = [
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי יגיע" }
];

const initialRsvp = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "מגיע"
};

function getEventCopy(event) {
  if (!event) {
    return { title: "", subtitle: "", closing: "נשמח לראותכם בין אורחינו…" };
  }

  if (event.eventType === "חתונה") {
    const fullNames = `${event.groomName || ""} & ${event.brideName || ""} ${event.familyName || ""}`.trim();
    return {
      title: `הנכם מוזמנים לאירוע חתונה של ${fullNames}`,
      subtitle: "שמחים ונרגשים להזמינכם לחגוג עמנו את נישואינו",
      closing: `נשמח לראותכם בין אורחינו, ${event.groomName || ""} ו${event.brideName || ""}`.trim()
    };
  }

  if (event.eventType === "ברית") {
    return {
      title: `הנכם מוזמנים לאירוע ברית של משפחת ${event.familyName || ""}`.trim(),
      subtitle: "שמחים להזמינכם לחגוג עמנו את ברית המילה של בנינו",
      closing: `נשמח לראותכם בין אורחינו, ${event.parentName1 || ""} ו${event.parentName2 || ""} ${event.familyName || ""}`.trim()
    };
  }

  return {
    title: `הנכם מוזמנים לאירוע ${event.eventType} של ${event.eventNames || ""}`.trim(),
    subtitle: "שמחים ונרגשים להזמינכם ליום המאושר בחיינו",
    closing: "נשמח לראותכם בין אורחינו…"
  };
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
    setForm((prev) => ({ ...prev, status }));
  };

  const increaseAttendees = () => {
    setForm((prev) => ({ ...prev, attendeesCount: Math.min(20, Number(prev.attendeesCount || 0) + 1) }));
  };

  const decreaseAttendees = () => {
    setForm((prev) => ({ ...prev, attendeesCount: Math.max(0, Number(prev.attendeesCount || 0) - 1) }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/public/event/${eventId}/rsvp`, form);
      setMessage("תודה! האישור נשמר בהצלחה");
      setForm(initialRsvp);
    } catch {
      setError("שליחת הטופס נכשלה. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="invite-page">
        <div className="invite-loading">
          <p>טוען את פרטי האירוע…</p>
        </div>
      </div>
    );
  }

  if (error && !eventData) {
    return (
      <div className="invite-page">
        <div className="invite-error-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const event = eventData?.event;
  const eventDateText = event?.eventDate ? String(event.eventDate) : "";
  const eventTimeText = event?.eventTime ? String(event.eventTime) : "";
  const hasEventImage = Boolean(event?.imageDataUrl);
  const eventCopy = getEventCopy(event);

  return (
    <div className="invite-page">
      <div className="invite-flow">
        {event ? (
          <>
            <header className="invite-hero">
              <div
                className={`invite-hero-media ${hasEventImage ? "has-image" : ""}`}
                style={hasEventImage ? { backgroundImage: `url(${event.imageDataUrl})` } : undefined}
                aria-hidden="true"
              >
                <div className="invite-hero-overlay" />
                <div className="invite-hero-content">
                  <h1 className="invite-hero-title">{eventCopy.title}</h1>
                  <p className="invite-hero-subtitle">{eventCopy.subtitle}</p>
                </div>
                {eventDateText ? <p className="invite-hero-date">{eventDateText}</p> : null}
              </div>
              {eventTimeText ? <p className="invite-subtitle">{eventTimeText}</p> : null}

              <div className="invite-details">
                <div className="invite-detail-row">
                  <span className="invite-detail-icon" aria-hidden="true">
                    <IconVenue />
                  </span>
                  <div className="invite-detail-text">
                    <span className="invite-detail-label">מתחם</span>
                    <p className="invite-detail-value">{event.venueName}</p>
                  </div>
                </div>
                <div className="invite-detail-row">
                  <span className="invite-detail-icon" aria-hidden="true">
                    <IconCity />
                  </span>
                  <div className="invite-detail-text">
                    <span className="invite-detail-label">עיר</span>
                    <p className="invite-detail-value">{event.city}</p>
                  </div>
                </div>
                <div className="invite-detail-row">
                  <span className="invite-detail-icon" aria-hidden="true">
                    <IconStreet />
                  </span>
                  <div className="invite-detail-text">
                    <span className="invite-detail-label">רחוב ומספר</span>
                    <p className="invite-detail-value">{event.streetAndNumber}</p>
                  </div>
                </div>
                <div className="invite-detail-row">
                  <span className="invite-detail-icon" aria-hidden="true">
                    <IconDate />
                  </span>
                  <div className="invite-detail-text">
                    <span className="invite-detail-label">תאריך</span>
                    <p className="invite-detail-value">{event.eventDate}</p>
                  </div>
                </div>
                <div className="invite-detail-row">
                  <span className="invite-detail-icon" aria-hidden="true">
                    <IconTime />
                  </span>
                  <div className="invite-detail-text">
                    <span className="invite-detail-label">שעה</span>
                    <p className="invite-detail-value">{event.eventTime}</p>
                  </div>
                </div>
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
                  className="field-input"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  placeholder="050-0000000"
                  value={form.phone}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="field attendees-field">
                <div className="attendees-header">
                  <span className="field-label">כמה מגיעים?</span>
                  <span className="attendees-hint">כולל ילדים</span>
                </div>
                <div className="attendees-stepper">
                  <button className="btn stepper-btn" type="button" onClick={increaseAttendees} aria-label="הגדלת כמות">
                    +
                  </button>
                  <input
                    id="attendeesCount"
                    className="field-input attendees-input"
                    name="attendeesCount"
                    type="number"
                    min="0"
                    value={form.attendeesCount}
                    onChange={onChange}
                    required
                  />
                  <button className="btn stepper-btn" type="button" onClick={decreaseAttendees} aria-label="הקטנת כמות">
                    -
                  </button>
                </div>
              </div>

              <div className="field">
                <span className="field-label">סטטוס הגעה</span>
                <div className="status-group status-group--horizontal" role="group" aria-label="סטטוס הגעה">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn status-btn ${form.status === option.value ? "is-selected" : ""}`}
                      onClick={() => setStatus(option.value)}
                      aria-pressed={form.status === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>
                {submitting ? "שולח…" : "אישור הגעה"}
              </button>

              <p className="invite-closing">{eventCopy.closing}</p>
            </>
          )}

          {error && eventData ? <p className="message message--error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
