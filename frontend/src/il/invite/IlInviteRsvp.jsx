import IlAnimateIn from "./IlAnimateIn.jsx";
import { getEventClosing } from "./ilInviteUtils.js";

const STATUS_OPTIONS = [
  { value: "מגיע", label: "אגיע", stateClass: "il-rsvp-btn--yes" },
  { value: "לא מגיע", label: "לא אגיע", stateClass: "il-rsvp-btn--no" },
  { value: "אולי", label: "אולי אגיע…", stateClass: "il-rsvp-btn--maybe" }
];

export default function IlInviteRsvp({
  previewMode = false,
  form,
  message,
  error,
  submitting,
  onChange,
  onStatusChange,
  onSubmit,
  onIncrease,
  onDecrease,
  event
}) {
  const isAttending = form.status === "מגיע";
  const closingText = getEventClosing(event);

  if (message) {
    return (
      <section className="il-invite-rsvp">
        <IlAnimateIn className="il-invite-success">
          <div className="il-invite-success__icon" aria-hidden="true">
            ✓
          </div>
          <h2>נשמח לראותכם!</h2>
          <p>האישור נקלט בהצלחה. תודה שהקדשתם רגע לעדכן אותנו.</p>
        </IlAnimateIn>
      </section>
    );
  }

  return (
    <section className="il-invite-rsvp" id="il-rsvp">
      <IlAnimateIn className="il-invite-rsvp__intro" delay={60}>
        <p className="il-invite-script il-invite-script--small">אשרו הגעה</p>
        <h2 className="il-invite-rsvp__title">נשמח לדעת שתחגגו איתנו</h2>
        <p className="il-invite-rsvp__hint">בלחיצה על שליחה נשמור את תשובתכם — תוכלו לעדכן בכל רגע</p>
      </IlAnimateIn>

      <form className="il-invite-rsvp__form" onSubmit={previewMode ? (e) => e.preventDefault() : onSubmit} noValidate>
        <IlAnimateIn className="il-invite-field" delay={120}>
          <label className="il-invite-field__label" htmlFor="il-rsvp-fullName">
            שם מלא
          </label>
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
        </IlAnimateIn>

        <IlAnimateIn className="il-invite-field" delay={180}>
          <label className="il-invite-field__label" htmlFor="il-rsvp-phone">
            טלפון
          </label>
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
        </IlAnimateIn>

        <IlAnimateIn className="il-invite-field" delay={240}>
          <span className="il-invite-field__label">סטטוס הגעה</span>
          <div className="il-invite-rsvp__status-group" role="group" aria-label="סטטוס הגעה">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`il-rsvp-btn ${option.stateClass} ${form.status === option.value ? "is-selected" : ""}`}
                onClick={() => !previewMode && onStatusChange(option.value)}
                aria-pressed={form.status === option.value}
                disabled={previewMode}
              >
                {option.label}
              </button>
            ))}
          </div>
        </IlAnimateIn>

        {isAttending ? (
          <IlAnimateIn className="il-invite-field" delay={300}>
            <span className="il-invite-field__label">כמה מגיעים?</span>
            <div className="il-invite-stepper">
              <button type="button" className="il-invite-stepper__btn" onClick={onIncrease} disabled={previewMode} aria-label="הגדלה">
                +
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
              <button type="button" className="il-invite-stepper__btn" onClick={onDecrease} disabled={previewMode} aria-label="הקטנה">
                −
              </button>
            </div>
          </IlAnimateIn>
        ) : null}

        <IlAnimateIn delay={360}>
          <button className="il-invite-submit" type="submit" disabled={previewMode || submitting}>
            <span>{submitting ? "שולח…" : "שלח"}</span>
            <span className="il-invite-submit__arrow" aria-hidden="true">
              ←
            </span>
          </button>
        </IlAnimateIn>

        {error ? <p className="il-invite-error">{error}</p> : null}

        <IlAnimateIn as="p" className="il-invite-closing" delay={420}>
          {closingText}
        </IlAnimateIn>
      </form>
    </section>
  );
}
