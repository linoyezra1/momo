import { useState } from "react";
import IlInviteCountdown from "./IlInviteCountdown.jsx";
import IlTimelineIcon from "./IlTimelineIcon.jsx";
import {
  getEventDisplayName,
  getFullDateText,
  getParallelTimeline,
  getVenueLine,
  getWeekdayLine,
  getWelcomeText,
  getWeddingNames
} from "./ilInviteUtils.js";
import "./il-invite.css";

const initialRsvp = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: ""
};

function attendeesCountForStatus(status, currentCount) {
  if (status === "מגיע") return Math.max(1, Number(currentCount) || 1);
  if (status === "לא מגיע") return 0;
  return currentCount;
}

export default function IlInviteExperience({
  event,
  previewMode = false,
  onSubmitRsvp,
  loading = false,
  loadError = ""
}) {
  const [form, setForm] = useState(initialRsvp);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rsvpStarted, setRsvpStarted] = useState(false);

  if (loading) {
    return (
      <div className="il-invite-page il-invite-page--state">
        <p className="il-invite-state">טוען את פרטי האירוע…</p>
      </div>
    );
  }

  if (loadError && !event) {
    return (
      <div className="il-invite-page il-invite-page--state">
        <p className="il-invite-state il-invite-error">{loadError}</p>
      </div>
    );
  }

  if (!event) return null;

  const isWedding = event.eventType === "חתונה";
  const welcomeText = getWelcomeText(event);
  const displayNames = isWedding ? getWeddingNames(event) : getEventDisplayName(event);
  const timeline = isWedding ? getParallelTimeline(event) : [];
  const showCountdown = previewMode || rsvpStarted || Boolean(message);
  const isAttending = form.status === "מגיע";

  function onChange(changeEvent) {
    const { name, value } = changeEvent.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" ? Number(value) : value
    }));
  }

  function onChooseStatus(status) {
    if (previewMode) return;
    setRsvpStarted(true);
    setForm((prev) => ({
      ...prev,
      status,
      attendeesCount: attendeesCountForStatus(status, prev.attendeesCount)
    }));
    setError("");
  }

  function onIncrease() {
    setForm((prev) => ({ ...prev, attendeesCount: Math.min(20, Number(prev.attendeesCount || 0) + 1) }));
  }

  function onDecrease() {
    setForm((prev) => ({ ...prev, attendeesCount: Math.max(1, Number(prev.attendeesCount || 1) - 1) }));
  }

  async function onSubmit(submitEvent) {
    submitEvent.preventDefault();
    if (previewMode || !onSubmitRsvp) return;
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        attendeesCount: attendeesCountForStatus(form.status, form.attendeesCount)
      };
      await onSubmitRsvp(payload);
      setMessage("תודה! האישור נשמר בהצלחה");
      setForm(initialRsvp);
      setRsvpStarted(false);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "שליחת הטופס נכשלה. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`il-invite-page${previewMode ? " il-invite-page--preview" : ""}`} dir="rtl" lang="he">
      <div className="il-invite-shell">
        <header className="il-invite-cover">
          {event.imageDataUrl ? (
            <img className="il-invite-cover__img" src={event.imageDataUrl} alt="" />
          ) : (
            <div className="il-invite-cover__placeholder" aria-hidden="true" />
          )}
        </header>

        <main className="il-invite-body">
          {isWedding ? (
            <p className="il-invite-welcome">{welcomeText}</p>
          ) : null}

          <h1 className="il-invite-names">{displayNames}</h1>

          <div className="il-invite-meta">
            <p className="il-invite-date">{getFullDateText(event)}</p>
            <p className="il-invite-weekday">{getWeekdayLine(event)}</p>
            <p className="il-invite-venue">{getVenueLine(event)}</p>
          </div>

          {isWedding && timeline.length ? (
            <section className="il-invite-timeline" aria-label="לוח זמנים">
              {timeline.map((item) => (
                <div key={item.key} className="il-invite-timeline__col">
                  <IlTimelineIcon name={item.icon} gifSrc={item.gifSrc} />
                  <p className="il-invite-timeline__label">{item.label}</p>
                  <p className="il-invite-timeline__time">{item.time}</p>
                </div>
              ))}
            </section>
          ) : !isWedding && event.eventTime ? (
            <p className="il-invite-single-time">בשעה {event.eventTime}</p>
          ) : null}

          <section className="il-invite-rsvp" id="il-rsvp">
            {message ? (
              <p className="il-invite-rsvp__success">{message}</p>
            ) : (
              <>
                <p className="il-invite-rsvp__separator">אנא אשרו את הגעתכם</p>

                {!rsvpStarted ? (
                  <div className="il-invite-rsvp__actions">
                    <button
                      type="button"
                      className="il-invite-rsvp__btn il-invite-rsvp__btn--yes"
                      onClick={() => onChooseStatus("מגיע")}
                      disabled={previewMode}
                    >
                      אגיע / אאשר הגעה
                    </button>
                    <button
                      type="button"
                      className="il-invite-rsvp__btn il-invite-rsvp__btn--no"
                      onClick={() => onChooseStatus("לא מגיע")}
                      disabled={previewMode}
                    >
                      לא יכול/ה להגיע
                    </button>
                  </div>
                ) : (
                  <form
                    className="il-invite-rsvp__form"
                    onSubmit={previewMode ? (e) => e.preventDefault() : onSubmit}
                    noValidate
                  >
                    <label className="il-invite-field" htmlFor="il-rsvp-fullName">
                      <span className="il-invite-field__label">שם מלא</span>
                      <input
                        id="il-rsvp-fullName"
                        className="il-invite-field__input"
                        name="fullName"
                        placeholder="הזינו שם מלא"
                        value={form.fullName}
                        onChange={onChange}
                        disabled={previewMode}
                        required
                      />
                    </label>

                    <label className="il-invite-field" htmlFor="il-rsvp-phone">
                      <span className="il-invite-field__label">טלפון</span>
                      <input
                        id="il-rsvp-phone"
                        className="il-invite-field__input il-invite-field__input--ltr"
                        name="phone"
                        type="tel"
                        dir="ltr"
                        inputMode="tel"
                        placeholder="050-0000000"
                        value={form.phone}
                        onChange={onChange}
                        disabled={previewMode}
                        required
                      />
                    </label>

                    {isAttending ? (
                      <div className="il-invite-field">
                        <span className="il-invite-field__label">כמה מגיעים?</span>
                        <div className="il-invite-stepper">
                          <button
                            type="button"
                            className="il-invite-stepper__btn"
                            onClick={onDecrease}
                            disabled={previewMode}
                            aria-label="הקטנה"
                          >
                            −
                          </button>
                          <input
                            className="il-invite-field__input il-invite-stepper__value"
                            name="attendeesCount"
                            type="number"
                            min="1"
                            value={form.attendeesCount}
                            onChange={onChange}
                            disabled={previewMode}
                            required
                          />
                          <button
                            type="button"
                            className="il-invite-stepper__btn"
                            onClick={onIncrease}
                            disabled={previewMode}
                            aria-label="הגדלה"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {error ? <p className="il-invite-rsvp__error">{error}</p> : null}

                    <button type="submit" className="il-invite-rsvp__submit" disabled={previewMode || submitting}>
                      {submitting ? "שולח…" : "שליחת אישור"}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>

          {showCountdown ? <IlInviteCountdown event={event} /> : null}
        </main>
      </div>
    </div>
  );
}
