import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../../api.js";
import {
  eventFormToPreviewPayload,
  eventInfoToForm,
  formToEventUpdatePayload
} from "../../utils/ilEventPreview.js";
import IlInvitationPreview from "./IlInvitationPreview.jsx";
import "../../us/client-portal.css";
import "../il-portal.css";

const EVENT_TYPE_OPTIONS = ["חתונה", "ברית", "בת מצווה", "אחר"];

export default function IlInvitationEditor({ userId, eventInfo, onClose, onSaved }) {
  const [form, setForm] = useState(() => eventInfoToForm(eventInfo));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const previewEvent = useMemo(() => eventFormToPreviewPayload(form), [form]);

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

      <div className="us-invitation-editor__layout min-h-0 flex-1 overflow-hidden">
        <div className="us-invitation-editor__form-panel h-full min-h-0 overflow-y-auto overscroll-y-contain pl-2 lg:h-[calc(100vh-8.5rem)] lg:max-h-[calc(100vh-8.5rem)]">
          <section className="us-editor-section">
            <h3>פרטי האירוע</h3>
            <label className="us-editor-field">
              סוג אירוע
              <select name="eventType" value={form.eventType} onChange={onChange}>
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {form.eventType === "חתונה" ? (
              <>
                <label className="us-editor-field">
                  שם החתן
                  <input name="groomName" value={form.groomName} onChange={onChange} placeholder="ישראל" />
                </label>
                <label className="us-editor-field">
                  שם הכלה
                  <input name="brideName" value={form.brideName} onChange={onChange} placeholder="ישראלה" />
                </label>
              </>
            ) : null}

            {form.eventType === "ברית" ? (
              <>
                <label className="us-editor-field">
                  שם הורה 1
                  <input name="parentName1" value={form.parentName1} onChange={onChange} />
                </label>
                <label className="us-editor-field">
                  שם הורה 2
                  <input name="parentName2" value={form.parentName2} onChange={onChange} />
                </label>
                <label className="us-editor-field">
                  תאריך עברי (אופציונלי)
                  <input
                    name="eventDateHebrew"
                    value={form.eventDateHebrew}
                    onChange={onChange}
                    placeholder='למשל: כ״ג באייר תשפ״ו'
                  />
                </label>
              </>
            ) : null}

            {form.eventType === "בת מצווה" ? (
              <>
                <label className="us-editor-field">
                  שם כלת המצווה
                  <input name="batMitzvahName" value={form.batMitzvahName} onChange={onChange} />
                </label>
                <label className="us-editor-field">
                  שם הורה 1
                  <input name="parentName1" value={form.parentName1} onChange={onChange} />
                </label>
                <label className="us-editor-field">
                  שם הורה 2 (אופציונלי)
                  <input name="parentName2" value={form.parentName2} onChange={onChange} />
                </label>
              </>
            ) : null}

            {form.eventType === "אחר" ? (
              <label className="us-editor-field">
                שמות / כותרת האירוע
                <input name="eventNames" value={form.eventNames} onChange={onChange} />
              </label>
            ) : null}
          </section>

          <section className="us-editor-section">
            <h3>מיקום וזמן</h3>
            <label className="us-editor-field">
              שם המתחם
              <input name="venueName" value={form.venueName} onChange={onChange} />
            </label>
            <label className="us-editor-field">
              עיר
              <input name="city" value={form.city} onChange={onChange} />
            </label>
            <label className="us-editor-field">
              רחוב ומספר
              <input name="streetAndNumber" value={form.streetAndNumber} onChange={onChange} />
            </label>
            <div className="us-editor-grid-2">
              <label className="us-editor-field">
                תאריך
                <input type="date" name="eventDate" value={form.eventDate} onChange={onChange} />
              </label>
              <label className="us-editor-field">
                שעה
                <input type="time" name="eventTime" value={form.eventTime} onChange={onChange} />
              </label>
            </div>
          </section>

          <section className="us-editor-section">
            <h3>תמונת קאבר</h3>
            <label className="us-editor-field">
              תמונת אירוע
              <input type="file" accept="image/*" onChange={onImageChange} />
            </label>
            {form.imageDataUrl ? (
              <img className="il-editor-cover-preview" src={form.imageDataUrl} alt="תצוגה מקדימה" />
            ) : null}
          </section>
        </div>

        <div className="us-invitation-editor__preview-panel sticky top-0 flex h-full min-h-0 flex-col self-start lg:max-h-[calc(100vh-8.5rem)]">
          <p className="us-invitation-editor__preview-label shrink-0">תצוגה חיה</p>
          <div className="us-invitation-editor__preview-frame min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
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
