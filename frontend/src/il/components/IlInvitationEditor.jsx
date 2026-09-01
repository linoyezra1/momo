import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../../api.js";
import {
  eventFormToPreviewPayload,
  eventInfoToForm,
  formToEventUpdatePayload
} from "../../utils/ilEventPreview.js";
import { getDefaultInviteWelcomeText, getCeremonyLabel, isCoupleEventType, isConferenceEventType } from "../../utils/eventTypeWording.js";
import { resolveCoverPreview, uploadEventCover } from "../../utils/eventCover.js";
import IlInvitationPreview from "./IlInvitationPreview.jsx";
import IlEditorField, { ilEditorInputClass, ilEditorSelectClass } from "./IlEditorField.jsx";
import "../../us/client-portal.css";
import "../il-portal.css";

const EVENT_TYPE_OPTIONS = ["חתונה", "חינה", "אירוסין", "ברית", "בר מצווה", "בת מצווה", "כנס", "אחר"];

export default function IlInvitationEditor({ userId, eventInfo, onClose, onSaved }) {
  const [form, setForm] = useState(() => eventInfoToForm(eventInfo));
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [toast, setToast] = useState("");

  const previewEvent = useMemo(() => eventFormToPreviewPayload(form), [form]);

  useEffect(() => {
    setForm(eventInfoToForm(eventInfo));
  }, [eventInfo]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow || "unset";
    };
  }, []);

  function onChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => {
      if (type === "checkbox") {
        const next = { ...prev, [name]: checked };
        if (name === "transportationEnabled" && !checked) {
          next.transportationWhatsAppLink = "";
        }
        return next;
      }
      if (name !== "eventType") {
        return { ...prev, [name]: value };
      }
      const previousDefault = getDefaultInviteWelcomeText(prev.eventType);
      const currentWelcome = String(prev.welcomeText || "").trim();
      const shouldReplaceWelcome =
        !currentWelcome ||
        currentWelcome === previousDefault ||
        currentWelcome === getDefaultInviteWelcomeText("חתונה") ||
        currentWelcome === getDefaultInviteWelcomeText("חינה") ||
        currentWelcome === getDefaultInviteWelcomeText("אירוסין") ||
        currentWelcome === getDefaultInviteWelcomeText("בר מצווה") ||
        currentWelcome === getDefaultInviteWelcomeText("בת מצווה") ||
        currentWelcome === getDefaultInviteWelcomeText("כנס");
      return {
        ...prev,
        eventType: value,
        welcomeText: shouldReplaceWelcome ? getDefaultInviteWelcomeText(value) : prev.welcomeText
      };
    });
  }

  function onImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setToast("יש לבחור קובץ תמונה בלבד");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setToast("התמונה גדולה מדי. העלו תמונה עד 8MB");
      event.target.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => {
      if (prev.coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.coverPreviewUrl);
      }
      return {
        ...prev,
        pendingCoverFile: file,
        coverPreviewUrl: previewUrl,
        clearCover: false,
        imageDataUrl: ""
      };
    });
  }

  function onRemoveCover() {
    setForm((prev) => {
      if (prev.coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.coverPreviewUrl);
      }
      return {
        ...prev,
        pendingCoverFile: null,
        coverPreviewUrl: "",
        cover: null,
        clearCover: true,
        imageDataUrl: ""
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setToast("");
    setUploadProgress(null);
    try {
      const response = await api.put(`/client/${userId}/event`, formToEventUpdatePayload(form));
      let event = response.data.event;
      if (form.pendingCoverFile) {
        setUploadProgress(0);
        const uploaded = await uploadEventCover({
          api,
          endpoint: `/client/${userId}/event/cover`,
          file: form.pendingCoverFile,
          onProgress: setUploadProgress
        });
        event = uploaded.event || event;
      }
      onSaved(event);
      setForm(eventInfoToForm(event));
      setToast("פרטי ההזמנה עודכנו בהצלחה!");
      window.setTimeout(() => setToast(""), 4000);
    } catch (saveError) {
      setToast(saveError.response?.data?.message || "שמירת ההזמנה נכשלה");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

  return createPortal(
    <div className="us-invitation-editor il-invitation-editor" dir="rtl" lang="he">
      <div className="us-invitation-editor__topbar">
        <div>
          <p className="us-invitation-editor__eyebrow">עריכת הזמנה</p>
          <h2 className="us-invitation-editor__title">עריכת תוכן ההזמנה ותצוגה חיה</h2>
        </div>
        <button type="button" className="us-invitation-editor__close" onClick={onClose} aria-label="סגירה">
          <X size={20} />
        </button>
      </div>

      <div className="us-invitation-editor__layout il-invitation-editor__layout">
        <div className="us-invitation-editor__form-panel il-invitation-editor__form-panel">
          <section className="us-editor-section il-editor-section">
            <h3>פרטי האירוע</h3>
            <IlEditorField label="סוג אירוע" htmlFor="il-eventType">
              <select
                id="il-eventType"
                className={ilEditorSelectClass}
                name="eventType"
                value={form.eventType}
                onChange={onChange}
              >
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </IlEditorField>

            {isCoupleEventType(form.eventType) ? (
              <>
                <IlEditorField label="שם החתן" htmlFor="il-groomName">
                  <input
                    id="il-groomName"
                    className={ilEditorInputClass}
                    name="groomName"
                    value={form.groomName}
                    onChange={onChange}
                    placeholder="ישראל"
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="שם הכלה" htmlFor="il-brideName">
                  <input
                    id="il-brideName"
                    className={ilEditorInputClass}
                    name="brideName"
                    value={form.brideName}
                    onChange={onChange}
                    placeholder="ישראלה"
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="טקסט פתיחה" htmlFor="il-welcomeText">
                  <textarea
                    id="il-welcomeText"
                    className={ilEditorInputClass}
                    name="welcomeText"
                    value={form.welcomeText}
                    onChange={onChange}
                    rows={3}
                    placeholder={getDefaultInviteWelcomeText(form.eventType)}
                  />
                </IlEditorField>
              </>
            ) : null}

            {form.eventType === "בר מצווה" || form.eventType === "בת מצווה" ? (
              <>
                <IlEditorField label="שם החוגג/ת" htmlFor="il-batMitzvahName">
                  <input
                    id="il-batMitzvahName"
                    className={ilEditorInputClass}
                    name="batMitzvahName"
                    value={form.batMitzvahName}
                    onChange={onChange}
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="שם הורה 1" htmlFor="il-parentName1-bm">
                  <input
                    id="il-parentName1-bm"
                    className={ilEditorInputClass}
                    name="parentName1"
                    value={form.parentName1}
                    onChange={onChange}
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="שם הורה 2 (אופציונלי)" htmlFor="il-parentName2-bm">
                  <input
                    id="il-parentName2-bm"
                    className={ilEditorInputClass}
                    name="parentName2"
                    value={form.parentName2}
                    onChange={onChange}
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="טקסט פתיחה" htmlFor="il-welcomeText-bm">
                  <textarea
                    id="il-welcomeText-bm"
                    className={ilEditorInputClass}
                    name="welcomeText"
                    value={form.welcomeText}
                    onChange={onChange}
                    rows={3}
                    placeholder={getDefaultInviteWelcomeText(form.eventType)}
                  />
                </IlEditorField>
              </>
            ) : null}

            {form.eventType === "ברית" ? (
              <>
                <IlEditorField label="שם הורה 1" htmlFor="il-parentName1-brit">
                  <input
                    id="il-parentName1-brit"
                    className={ilEditorInputClass}
                    name="parentName1"
                    value={form.parentName1}
                    onChange={onChange}
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="שם הורה 2" htmlFor="il-parentName2-brit">
                  <input
                    id="il-parentName2-brit"
                    className={ilEditorInputClass}
                    name="parentName2"
                    value={form.parentName2}
                    onChange={onChange}
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="תאריך עברי (אופציונלי)" htmlFor="il-eventDateHebrew">
                  <input
                    id="il-eventDateHebrew"
                    className={ilEditorInputClass}
                    name="eventDateHebrew"
                    value={form.eventDateHebrew}
                    onChange={onChange}
                    placeholder='למשל: כ״ג באייר תשפ״ו'
                    autoComplete="off"
                  />
                </IlEditorField>
              </>
            ) : null}


            {form.eventType === "אחר" ? (
              <IlEditorField label="שמות / כותרת האירוע" htmlFor="il-eventNames">
                <input
                  id="il-eventNames"
                  className={ilEditorInputClass}
                  name="eventNames"
                  value={form.eventNames}
                  onChange={onChange}
                  autoComplete="off"
                />
              </IlEditorField>
            ) : null}

            {isConferenceEventType(form.eventType) ? (
              <>
                <IlEditorField label="שם מארגן הכנס" htmlFor="il-organizerName">
                  <input
                    id="il-organizerName"
                    className={ilEditorInputClass}
                    name="organizerName"
                    value={form.organizerName}
                    onChange={onChange}
                    placeholder="שם היזם / המארגן"
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="שם הבמה / מותג הכנס" htmlFor="il-conferenceBrandName">
                  <input
                    id="il-conferenceBrandName"
                    className={ilEditorInputClass}
                    name="conferenceBrandName"
                    value={form.conferenceBrandName}
                    onChange={onChange}
                    placeholder="שם הכנס בסושיאל"
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="הנדל בסושיאל (אופציונלי)" htmlFor="il-socialHandle">
                  <input
                    id="il-socialHandle"
                    className={ilEditorInputClass}
                    name="socialHandle"
                    value={form.socialHandle}
                    onChange={onChange}
                    placeholder="@conference"
                    dir="ltr"
                    autoComplete="off"
                  />
                </IlEditorField>
                <IlEditorField label="טקסט פתיחה" htmlFor="il-welcomeText-conf">
                  <textarea
                    id="il-welcomeText-conf"
                    className={ilEditorInputClass}
                    name="welcomeText"
                    value={form.welcomeText}
                    onChange={onChange}
                    rows={3}
                    placeholder={getDefaultInviteWelcomeText(form.eventType)}
                  />
                </IlEditorField>
              </>
            ) : null}
          </section>

          <section className="us-editor-section il-editor-section">
            <h3>{isConferenceEventType(form.eventType) ? "מיקום, זמן ופרטים" : "מיקום וזמן"}</h3>
            {isConferenceEventType(form.eventType) ? (
              <>
                <IlEditorField label="כתובת מלאה" htmlFor="il-locationAddress">
                  <input
                    id="il-locationAddress"
                    className={ilEditorInputClass}
                    name="locationAddress"
                    value={form.locationAddress}
                    onChange={onChange}
                    placeholder="רחוב, מספר, עיר"
                    autoComplete="off"
                  />
                </IlEditorField>
                <div className="il-editor-grid-2">
                  <IlEditorField label="תאריך" htmlFor="il-eventDate">
                    <input
                      id="il-eventDate"
                      className={ilEditorInputClass}
                      type="date"
                      name="eventDate"
                      value={form.eventDate}
                      onChange={onChange}
                    />
                  </IlEditorField>
                  <IlEditorField label="שעת התכנסות" htmlFor="il-eventTime">
                    <input
                      id="il-eventTime"
                      className={ilEditorInputClass}
                      type="time"
                      name="eventTime"
                      value={form.eventTime}
                      onChange={onChange}
                    />
                  </IlEditorField>
                </div>
                <IlEditorField label="פרטי חניה / הוראות הגעה" htmlFor="il-parkingDetails">
                  <textarea
                    id="il-parkingDetails"
                    className={ilEditorInputClass}
                    name="parkingDetails"
                    value={form.parkingDetails}
                    onChange={onChange}
                    rows={2}
                    placeholder="חניון תת-קרקעי, כניסה מרחוב…"
                  />
                </IlEditorField>
                <IlEditorField label="קישור לאתר הכנס" htmlFor="il-websiteUrl">
                  <input
                    id="il-websiteUrl"
                    className={ilEditorInputClass}
                    name="websiteUrl"
                    value={form.websiteUrl}
                    onChange={onChange}
                    placeholder="https://"
                    dir="ltr"
                    autoComplete="off"
                  />
                </IlEditorField>
              </>
            ) : (
              <>
            <IlEditorField label="שם המתחם" htmlFor="il-venueName">
              <input
                id="il-venueName"
                className={ilEditorInputClass}
                name="venueName"
                value={form.venueName}
                onChange={onChange}
                autoComplete="off"
              />
            </IlEditorField>
            <IlEditorField label="עיר" htmlFor="il-city">
              <input
                id="il-city"
                className={ilEditorInputClass}
                name="city"
                value={form.city}
                onChange={onChange}
                autoComplete="off"
              />
            </IlEditorField>
            <IlEditorField label="רחוב ומספר" htmlFor="il-streetAndNumber">
              <input
                id="il-streetAndNumber"
                className={ilEditorInputClass}
                name="streetAndNumber"
                value={form.streetAndNumber}
                onChange={onChange}
                autoComplete="off"
              />
            </IlEditorField>
            <div className="il-editor-grid-2">
              <IlEditorField label="תאריך" htmlFor="il-eventDate">
                <input
                  id="il-eventDate"
                  className={ilEditorInputClass}
                  type="date"
                  name="eventDate"
                  value={form.eventDate}
                  onChange={onChange}
                />
              </IlEditorField>
              {isCoupleEventType(form.eventType) ? (
                <IlEditorField label="שעת קבלת פנים" htmlFor="il-receptionTime">
                  <input
                    id="il-receptionTime"
                    className={ilEditorInputClass}
                    type="time"
                    name="receptionTime"
                    value={form.receptionTime}
                    onChange={onChange}
                  />
                </IlEditorField>
              ) : (
                <IlEditorField label="שעה" htmlFor="il-eventTime">
                  <input
                    id="il-eventTime"
                    className={ilEditorInputClass}
                    type="time"
                    name="eventTime"
                    value={form.eventTime}
                    onChange={onChange}
                  />
                </IlEditorField>
              )}
            </div>
            {isCoupleEventType(form.eventType) ? (
              <IlEditorField label={`שעת ${getCeremonyLabel(form.eventType)}`} htmlFor="il-eventTime">
                <input
                  id="il-eventTime"
                  className={ilEditorInputClass}
                  type="time"
                  name="eventTime"
                  value={form.eventTime}
                  onChange={onChange}
                />
              </IlEditorField>
            ) : null}
              </>
            )}
          </section>

          <section className="us-editor-section il-editor-section">
            <h3>שאלות באישור הגעה</h3>
            <label className="il-editor-toggle">
              <input
                type="checkbox"
                name="transportationEnabled"
                checked={Boolean(form.transportationEnabled)}
                onChange={onChange}
              />
              <span>אפשר תיאום הסעות וטרמפים</span>
            </label>
            {form.transportationEnabled ? (
              <IlEditorField
                label="קישור לקבוצת וואטסאפ לטרמפים (אופציונלי)"
                htmlFor="il-transportationWhatsAppLink"
              >
                <input
                  id="il-transportationWhatsAppLink"
                  className={ilEditorInputClass}
                  name="transportationWhatsAppLink"
                  value={form.transportationWhatsAppLink}
                  onChange={onChange}
                  placeholder="https://chat.whatsapp.com/..."
                  dir="ltr"
                  autoComplete="off"
                />
              </IlEditorField>
            ) : null}
            <label className="il-editor-toggle">
              <input
                type="checkbox"
                name="foodSensitivitiesEnabled"
                checked={Boolean(form.foodSensitivitiesEnabled)}
                onChange={onChange}
              />
              <span>שאל לגבי רגישויות למזון / אלרגיות</span>
            </label>
          </section>

          <section className="us-editor-section il-editor-section">
            <h3>תמונת קאבר</h3>
            <IlEditorField label="תמונת אירוע" htmlFor="il-eventImage">
              <input
                id="il-eventImage"
                className="il-editor-file"
                type="file"
                accept="image/*"
                onChange={onImageChange}
              />
            </IlEditorField>
            {resolveCoverPreview(form) ? (
              <>
                <img
                  className="il-editor-cover-preview"
                  src={resolveCoverPreview(form)}
                  alt="תצוגה מקדימה"
                />
                <button type="button" className="il-editor-remove-cover" onClick={onRemoveCover}>
                  הסרת תמונה
                </button>
              </>
            ) : null}
            {uploadProgress != null ? <p className="il-editor-upload-progress">מעלה… {uploadProgress}%</p> : null}
          </section>
        </div>

        <div className="us-invitation-editor__preview-panel il-invitation-editor__preview-panel">
          <p className="us-invitation-editor__preview-label">תצוגה חיה</p>
          <div className="us-invitation-editor__preview-frame">
            <div className="us-invitation-editor__preview-scale">
              <IlInvitationPreview event={previewEvent} />
            </div>
          </div>
        </div>
      </div>

      <div className="us-invitation-editor__footer">
        {toast ? <p className="us-invitation-editor__toast">{toast}</p> : <span />}
        <button type="button" className="us-invitation-editor__save" onClick={handleSave} disabled={saving}>
          {saving ? "שומר…" : "שמירת שינויים"}
        </button>
      </div>
    </div>,
    document.body
  );
}
