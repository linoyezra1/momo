import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../../api.js";
import {
  DEFAULT_WELCOME_TEXT,
  eventFormToPreviewPayload,
  eventInfoToForm,
  formToEventUpdatePayload
} from "../../utils/ilEventPreview.js";
import IlInvitationPreview from "./IlInvitationPreview.jsx";
import IlEditorField, { ilEditorInputClass, ilEditorSelectClass } from "./IlEditorField.jsx";
import "../../us/client-portal.css";
import "../il-portal.css";

const EVENT_TYPE_OPTIONS = ["חתונה", "ברית", "בת מצווה", "אחר"];

export default function IlInvitationEditor({ userId, eventInfo, onClose, onSaved }) {
  const [form, setForm] = useState(() => eventInfoToForm(eventInfo));
  const [saving, setSaving] = useState(false);
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
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function onImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({ ...prev, imageDataUrl: "" }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setToast("יש לבחור קובץ תמונה בלבד");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setToast("התמונה גדולה מדי. העלו תמונה עד 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const resultData = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, imageDataUrl: resultData }));
    };
    reader.onerror = () => setToast("נכשלה קריאת קובץ התמונה");
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setToast("");
    try {
      const response = await api.put(`/client/${userId}/event`, formToEventUpdatePayload(form));
      onSaved(response.data.event);
      setToast("פרטי ההזמנה עודכנו בהצלחה!");
      window.setTimeout(() => setToast(""), 4000);
    } catch (saveError) {
      setToast(saveError.response?.data?.message || "שמירת ההזמנה נכשלה");
    } finally {
      setSaving(false);
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

            {form.eventType === "חתונה" ? (
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
                    placeholder={DEFAULT_WELCOME_TEXT}
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

            {form.eventType === "בת מצווה" ? (
              <>
                <IlEditorField label="שם כלת המצווה" htmlFor="il-batMitzvahName">
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
          </section>

          <section className="us-editor-section il-editor-section">
            <h3>מיקום וזמן</h3>
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
              {form.eventType === "חתונה" ? (
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
            {form.eventType === "חתונה" ? (
              <IlEditorField label="שעת חופה וקידושין" htmlFor="il-eventTime">
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
            {form.imageDataUrl ? (
              <img className="il-editor-cover-preview" src={form.imageDataUrl} alt="תצוגה מקדימה" />
            ) : null}
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
