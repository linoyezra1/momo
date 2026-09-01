import { useState } from "react";
import { Calendar, Car, Clock, Globe, MapPin } from "lucide-react";
import IlInviteCountdown from "./IlInviteCountdown.jsx";
import IlTimelineIcon from "./IlTimelineIcon.jsx";
import {
  getEventDisplayName,
  getFullDateText,
  getParallelTimeline,
  getVenueLine,
  getWeekdayLine,
  getWelcomeText,
  getWeddingNames,
  getInviteParentsLine,
  normalizeWebsiteUrl
} from "./ilInviteUtils.js";
import { isCoupleEventType, isConferenceEventType } from "../../utils/eventTypeWording.js";
import { getEventCoverSrc, getEventCoverSrcSet } from "../../utils/eventCover.js";
import "./il-invite.css";

const initialRsvp = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "",
  needsTransportation: null,
  hasFoodSensitivity: null,
  foodSensitivities: ""
};

function attendeesCountForStatus(status, currentCount) {
  if (status === "מגיע" || status === "אולי" || status === "לא מגיע") {
    return Math.max(1, Number(currentCount) || 1);
  }
  return currentCount;
}

function ConferenceDetailRow({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="il-invite-conference-row">
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <p className="il-invite-conference-row__label">{label}</p>
        <div className="il-invite-conference-row__value">{children}</div>
      </div>
    </div>
  );
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
  const [transportSuccess, setTransportSuccess] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rsvpStarted, setRsvpStarted] = useState(false);

  if (loading) {
    return (
      <div className="il-invite-page il-invite-page--state il-invite-page--shell" dir="rtl" lang="he">
        <div className="il-invite-shell">
          <header className="il-invite-cover">
            <div className="il-invite-cover__placeholder" aria-hidden="true" />
          </header>
          <main className="il-invite-body">
            <p className="il-invite-state">טוען את פרטי האירוע…</p>
          </main>
        </div>
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

  const isCoupleEvent = isCoupleEventType(event.eventType);
  const isConference = isConferenceEventType(event.eventType);
  const welcomeText = getWelcomeText(event);
  const displayNames = isCoupleEvent ? getWeddingNames(event) : getEventDisplayName(event);
  const timeline = isCoupleEvent ? getParallelTimeline(event) : [];
  const coverSrc = getEventCoverSrc(event);
  const coverSrcSet = getEventCoverSrcSet(event);
  const showCountdown = previewMode || rsvpStarted || Boolean(message) || Boolean(transportSuccess);
  const showAttendeeStepper =
    !isConference &&
    (form.status === "מגיע" || form.status === "אולי" || form.status === "לא מגיע");
  const parentsLine = getInviteParentsLine(event);
  const isMitzvahEvent = event.eventType === "בר מצווה" || event.eventType === "בת מצווה";
  const venueLine = getVenueLine(event);
  const eventTime = String(event.eventTime || "").trim();
  const organizerName = String(event.organizerName || "").trim();
  const socialHandle = String(event.socialHandle || "").trim();
  const parkingDetails = String(event.parkingDetails || "").trim();
  const websiteUrl = normalizeWebsiteUrl(event.websiteUrl);
  const transportationEnabled = event.transportationEnabled === true;
  const foodSensitivitiesEnabled = event.foodSensitivitiesEnabled === true;
  const transportationWhatsAppLink = String(event.transportationWhatsAppLink || "").trim();
  const showRsvpExtras =
    form.status === "מגיע" || form.status === "אולי";

  function onChange(changeEvent) {
    const { name, value } = changeEvent.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" ? Number(value) : value
    }));
  }

  function onChooseBooleanField(name, value) {
    if (previewMode) return;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "hasFoodSensitivity" && !value) {
        next.foodSensitivities = "";
      }
      return next;
    });
  }

  function onChooseStatus(status) {
    if (previewMode) return;
    setRsvpStarted(true);
    setForm((prev) => ({
      ...prev,
      status,
      attendeesCount: isConference ? 1 : attendeesCountForStatus(status, prev.attendeesCount),
      needsTransportation: null,
      hasFoodSensitivity: null,
      foodSensitivities: ""
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
    if (transportationEnabled && showRsvpExtras && form.needsTransportation == null) {
      setError("יש לבחור האם נדרשת הסעה / טרמפ");
      return;
    }
    if (foodSensitivitiesEnabled && showRsvpExtras && form.hasFoodSensitivity == null) {
      setError("יש לבחור האם קיימת רגישות למזון");
      return;
    }
    if (
      foodSensitivitiesEnabled &&
      showRsvpExtras &&
      form.hasFoodSensitivity === true &&
      !String(form.foodSensitivities || "").trim()
    ) {
      setError("יש לפרט את הרגישות למזון");
      return;
    }
    setMessage("");
    setTransportSuccess(null);
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        status: form.status,
        attendeesCount: isConference ? 1 : attendeesCountForStatus(form.status, form.attendeesCount)
      };
      if (transportationEnabled && showRsvpExtras && form.needsTransportation != null) {
        payload.needsTransportation = form.needsTransportation === true;
      }
      if (foodSensitivitiesEnabled && showRsvpExtras && form.hasFoodSensitivity === true) {
        payload.foodSensitivities = String(form.foodSensitivities || "").trim();
      }
      await onSubmitRsvp(payload);
      if (transportationEnabled && payload.needsTransportation) {
        setTransportSuccess(
          transportationWhatsAppLink
            ? { type: "link", href: transportationWhatsAppLink }
            : { type: "no-link" }
        );
        setMessage("");
      } else {
        setMessage(isConference ? "תודה! הרישום נשמר בהצלחה" : "תודה! האישור נשמר בהצלחה");
        setTransportSuccess(null);
      }
      setForm(initialRsvp);
      setRsvpStarted(false);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "שליחת הטופס נכשלה. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`il-invite-page${previewMode ? " il-invite-page--preview" : ""}${isConference ? " il-invite-page--conference" : ""}`}
      dir="rtl"
      lang="he"
    >
      <div className="il-invite-shell">
        <header className="il-invite-cover">
          {coverSrc ? (
            <img
              className="il-invite-cover__img"
              src={coverSrc}
              srcSet={coverSrcSet || undefined}
              sizes="(max-width: 720px) 100vw, 720px"
              width={event.cover?.width || undefined}
              height={event.cover?.height || undefined}
              alt=""
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <div className="il-invite-cover__placeholder" aria-hidden="true" />
          )}
        </header>

        <main className="il-invite-body">
          {isConference ? (
            <>
              <p className="il-invite-welcome">{welcomeText}</p>
              <h1 className="il-invite-names">{displayNames}</h1>
              {organizerName ? (
                <p className="il-invite-conference-organizer">מארגן הכנס: {organizerName}</p>
              ) : null}
              {socialHandle ? (
                <p className="il-invite-conference-social" dir="ltr">
                  {socialHandle}
                </p>
              ) : null}

              <section className="il-invite-conference-details" aria-label="פרטי הכנס">
                <ConferenceDetailRow icon={Calendar} label="תאריך">
                  <span>
                    {getFullDateText(event)}
                    {getWeekdayLine(event) !== "—" ? ` · ${getWeekdayLine(event)}` : ""}
                  </span>
                </ConferenceDetailRow>
                <ConferenceDetailRow icon={Clock} label="שעת התכנסות">
                  {eventTime || null}
                </ConferenceDetailRow>
                <ConferenceDetailRow icon={MapPin} label="כתובת">
                  {venueLine && venueLine !== "—" ? venueLine : null}
                </ConferenceDetailRow>
                <ConferenceDetailRow icon={Car} label="חניה / הוראות הגעה">
                  {parkingDetails || null}
                </ConferenceDetailRow>
                <ConferenceDetailRow icon={Globe} label="אתר הכנס">
                  {websiteUrl ? (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                      {String(event.websiteUrl || "").trim()}
                    </a>
                  ) : null}
                </ConferenceDetailRow>
              </section>
            </>
          ) : (
            <>
              {isCoupleEvent || isMitzvahEvent ? (
                <p className="il-invite-welcome">{welcomeText}</p>
              ) : null}

              <h1 className="il-invite-names">{displayNames}</h1>

              <div className="il-invite-meta">
                <p className="il-invite-date">{getFullDateText(event)}</p>
                <p className="il-invite-weekday">{getWeekdayLine(event)}</p>
                {venueLine && venueLine !== "—" ? <p className="il-invite-venue">{venueLine}</p> : null}
                {isMitzvahEvent && eventTime ? <p className="il-invite-venue">בשעה {eventTime}</p> : null}
              </div>

              {isCoupleEvent && timeline.length ? (
                <section className="il-invite-timeline" aria-label="לוח זמנים">
                  {timeline.map((item) => (
                    <div key={item.key} className="il-invite-timeline__col">
                      <IlTimelineIcon name={item.icon} />
                      <p className="il-invite-timeline__label">{item.label}</p>
                      <p className="il-invite-timeline__time">{item.time}</p>
                    </div>
                  ))}
                </section>
              ) : !isCoupleEvent && !isMitzvahEvent && eventTime ? (
                <p className="il-invite-single-time">בשעה {eventTime}</p>
              ) : null}

              {parentsLine ? <p className="il-invite-parents-line">{parentsLine}</p> : null}
            </>
          )}

          <section className="il-invite-rsvp" id="il-rsvp">
            {transportSuccess ? (
              <div className="il-invite-rsvp__success il-invite-rsvp__transport-success">
                {transportSuccess.type === "link" ? (
                  <>
                    <p>
                      תודה על העדכון! פתחנו קבוצת וואטסאפ לתיאום טרמפים, מוזמנים להצטרף:
                    </p>
                    <a
                      className="il-invite-rsvp__transport-link"
                      href={transportSuccess.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      הצטרפות לקבוצת הטרמפים
                    </a>
                  </>
                ) : (
                  <p>תודה על העדכון! רשמנו לפנינו ונשתדל לדאוג לפתרון הסעה בהתאם.</p>
                )}
              </div>
            ) : message ? (
              <p className="il-invite-rsvp__success">{message}</p>
            ) : (
              <>
                <p className="il-invite-rsvp__separator">
                  {isConference ? "רישום משתתפים — אנא אשרו הגעה" : "אנא אשרו את הגעתכם"}
                </p>

                {!rsvpStarted ? (
                  <div className="il-invite-rsvp__actions">
                    <button
                      type="button"
                      className="il-invite-rsvp__btn il-invite-rsvp__btn--yes"
                      onClick={() => onChooseStatus("מגיע")}
                      disabled={previewMode}
                    >
                      {isConference ? "כן, אני אגיע!" : "אגיע / אאשר הגעה"}
                    </button>
                    {!isConference ? (
                      <button
                        type="button"
                        className="il-invite-rsvp__btn il-invite-rsvp__btn--maybe"
                        onClick={() => onChooseStatus("אולי")}
                        disabled={previewMode}
                      >
                        אולי / עדיין לא יודע
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="il-invite-rsvp__btn il-invite-rsvp__btn--no"
                      onClick={() => onChooseStatus("לא מגיע")}
                      disabled={previewMode}
                    >
                      {isConference ? "לא אוכל להגיע" : "לא יכול/ה להגיע"}
                    </button>
                  </div>
                ) : (
                  <form
                    className="il-invite-rsvp__form"
                    onSubmit={previewMode ? (e) => e.preventDefault() : onSubmit}
                    noValidate
                  >
                    <p className="il-invite-rsvp__choice">
                      בחרתם:{" "}
                      <strong>
                        {form.status === "מגיע"
                          ? isConference
                            ? "כן, אני אגיע!"
                            : "מגיע"
                          : form.status === "אולי"
                            ? "אולי"
                            : "לא מגיע"}
                      </strong>
                      {!previewMode ? (
                        <button
                          type="button"
                          className="il-invite-rsvp__change"
                          onClick={() => {
                            setRsvpStarted(false);
                            setError("");
                          }}
                        >
                          שינוי
                        </button>
                      ) : null}
                    </p>
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

                    {showAttendeeStepper ? (
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

                    {showRsvpExtras && transportationEnabled ? (
                      <div className="il-invite-field">
                        <span className="il-invite-field__label">צריכים הסעה / טרמפ?</span>
                        <div className="il-invite-rsvp__binary">
                          <button
                            type="button"
                            className={`il-invite-rsvp__binary-btn${
                              form.needsTransportation === true ? " is-active" : ""
                            }`}
                            onClick={() => onChooseBooleanField("needsTransportation", true)}
                            disabled={previewMode}
                          >
                            כן
                          </button>
                          <button
                            type="button"
                            className={`il-invite-rsvp__binary-btn${
                              form.needsTransportation === false ? " is-active" : ""
                            }`}
                            onClick={() => onChooseBooleanField("needsTransportation", false)}
                            disabled={previewMode}
                          >
                            לא
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {showRsvpExtras && foodSensitivitiesEnabled ? (
                      <>
                        <div className="il-invite-field">
                          <span className="il-invite-field__label">יש רגישות למזון או אלרגיה כלשהי?</span>
                          <div className="il-invite-rsvp__binary">
                            <button
                              type="button"
                              className={`il-invite-rsvp__binary-btn${
                                form.hasFoodSensitivity === true ? " is-active" : ""
                              }`}
                              onClick={() => onChooseBooleanField("hasFoodSensitivity", true)}
                              disabled={previewMode}
                            >
                              כן
                            </button>
                            <button
                              type="button"
                              className={`il-invite-rsvp__binary-btn${
                                form.hasFoodSensitivity === false ? " is-active" : ""
                              }`}
                              onClick={() => onChooseBooleanField("hasFoodSensitivity", false)}
                              disabled={previewMode}
                            >
                              לא
                            </button>
                          </div>
                        </div>
                        {form.hasFoodSensitivity === true ? (
                          <label className="il-invite-field" htmlFor="il-rsvp-foodSensitivities">
                            <span className="il-invite-field__label">
                              פרט/י כאן את הרגישות (למשל: צליאק, אלרגיה לאגוזים, טבעוני וכו&apos;)
                            </span>
                            <textarea
                              id="il-rsvp-foodSensitivities"
                              className="il-invite-field__input"
                              name="foodSensitivities"
                              rows={3}
                              value={form.foodSensitivities}
                              onChange={onChange}
                              disabled={previewMode}
                              required
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}

                    {error ? <p className="il-invite-rsvp__error">{error}</p> : null}

                    <button type="submit" className="il-invite-rsvp__submit" disabled={previewMode || submitting}>
                      {submitting ? "שולח…" : isConference ? "שליחת רישום" : "שליחת אישור"}
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
