import { useEffect, useMemo, useState } from "react";
import api from "../api";
import {
  buildDefaultTemplateVars,
  renderWhatsAppTemplatePreview,
  sanitizeTemplateVariable,
  TEMPLATE_FIELD_META,
  validateTemplateVars
} from "../utils/twilioTemplate.js";

const PREVIEW_SAMPLE_NAME = "יצחק כהן";

export default function IlBulkWhatsAppModal({
  userId,
  eventInfo,
  guests,
  selectedGuestIds,
  whatsappQuota,
  initialPaymentCode = "",
  onClose,
  onSuccess
}) {
  const [step, setStep] = useState("preview");
  const [templateVars, setTemplateVars] = useState({ "2": "", "3": "", "4": "", "5": "" });
  const [paymentCode, setPaymentCode] = useState(initialPaymentCode);
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const selectedCount = selectedGuestIds.size;

  const previewGuestName = useMemo(() => {
    const firstSelected = guests.find((guest) => selectedGuestIds.has(guest._id));
    return firstSelected?.fullName?.trim() || PREVIEW_SAMPLE_NAME;
  }, [guests, selectedGuestIds]);

  useEffect(() => {
    setPaymentCode(initialPaymentCode);
  }, [initialPaymentCode]);

  useEffect(() => {
    if (!eventInfo || !userId) return;
    setTemplateVars(
      buildDefaultTemplateVars(eventInfo, userId, window.location.origin)
    );
  }, [eventInfo, userId]);

  const previewText = useMemo(
    () =>
      renderWhatsAppTemplatePreview({
        guestName: previewGuestName,
        vars: templateVars
      }),
    [previewGuestName, templateVars]
  );

  const onVarChange = (key, rawValue) => {
    const sanitized = sanitizeTemplateVariable(rawValue.replace(/[\n\r\t]+/g, " "));
    setTemplateVars((prev) => ({ ...prev, [key]: sanitized }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next.general;
      return next;
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult("");

    if (!selectedCount) {
      setError("יש לבחור לפחות מוזמן אחד מהטבלה");
      return;
    }
    if (!paymentCode.trim()) {
      setError("יש להזין קוד רכישה");
      return;
    }

    const validationErrors = validateTemplateVars(templateVars);
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setStep("edit");
      return;
    }

    setSending(true);
    try {
      const response = await api.post(`/client/${userId}/whatsapp/bulk-send`, {
        paymentCode: paymentCode.trim(),
        guestIds: [...selectedGuestIds],
        templateVariables: {
          "2": sanitizeTemplateVariable(templateVars["2"]),
          "3": sanitizeTemplateVariable(templateVars["3"]),
          "5": sanitizeTemplateVariable(templateVars["5"])
        }
      });

      if (response.data?.success === false) {
        setError(response.data?.message || "שליחת ההודעות נכשלה");
        return;
      }

      setResult(response.data?.message || "ההודעות נשלחו בהצלחה");
      onSuccess?.(response.data);
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "שליחת ההודעה נכשלה, נא לוודא שמספר המערכת מוגדר כראוי"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="us-modal-backdrop" role="presentation">
      <form className="us-modal-card il-bulk-whatsapp-modal" onSubmit={onSubmit}>
        <h2 className="us-modal-title">תפוצה רחבה — WhatsApp</h2>
        <p className="il-bulk-whatsapp-intro">
          ההודעה נשלחת לפי תבנית מאושרת של WhatsApp. ערכו רק את המשתנים המותרים — המערכת תדאג לעמידה בחוקי Twilio.
          <br />
          <strong>שימו לב:</strong> המספר נשלח מחברת momoEVENT.
        </p>

        {whatsappQuota ? (
          <p className="il-bulk-whatsapp-quota">
            מכסה פעילה: נותרו <strong>{whatsappQuota.remaining_credits}</strong> /{" "}
            {whatsappQuota.total_credits} הודעות
          </p>
        ) : null}

        <div className="il-bulk-whatsapp-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={step === "preview"}
            className={`il-bulk-whatsapp-tab${step === "preview" ? " is-active" : ""}`}
            onClick={() => setStep("preview")}
          >
            תצוגה מקדימה
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={step === "edit"}
            className={`il-bulk-whatsapp-tab${step === "edit" ? " is-active" : ""}`}
            onClick={() => setStep("edit")}
          >
            עריכת משתנים
          </button>
        </div>

        <div className="il-bulk-whatsapp-body">
          {step === "preview" ? (
            <div className="il-wa-preview-wrap">
              <p className="il-wa-preview-label">
                כך תיראה ההודעה אצל <strong>{previewGuestName}</strong> (שם המוזמן יוחלף אוטומטית לכל נמען)
              </p>
              <div className="il-wa-preview-phone">
                <div className="il-wa-preview-bubble">
                  <pre className="il-wa-preview-text">{previewText}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="il-bulk-whatsapp-fields">
              <p className="il-bulk-whatsapp-fields-intro">
                ערכו את המשתנים בלבד. אין להוסיף שורות חדשות או אימוג&apos;ים — הם יוסרו אוטומטית בשליחה.
              </p>
              <p className="il-bulk-whatsapp-readonly-note">
                <strong>{"{{1}}"}</strong> = שם המוזמן (אוטומטי) · <strong>{"{{4}}"}</strong> = קישור RSVP (אוטומטי)
              </p>
              {TEMPLATE_FIELD_META.map((field) => (
                <div key={field.key} className="us-field">
                  <label className="us-field-label" htmlFor={`bulk-var-${field.key}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <input
                    id={`bulk-var-${field.key}`}
                    className="us-field-input"
                    type="text"
                    dir={field.key === "4" ? "ltr" : "rtl"}
                    value={templateVars[field.key] || ""}
                    onChange={(event) => onVarChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    readOnly={field.readOnly}
                    disabled={field.readOnly}
                    required={field.required}
                  />
                  {field.hint ? <p className="il-bulk-field-hint">{field.hint}</p> : null}
                  {fieldErrors[field.key] ? (
                    <p className="il-bulk-field-error">{fieldErrors[field.key]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <aside className="il-wa-preview-sidebar" aria-hidden={step !== "edit"}>
            <p className="il-wa-preview-label">תצוגה חיה</p>
            <div className="il-wa-preview-phone il-wa-preview-phone--compact">
              <div className="il-wa-preview-bubble">
                <pre className="il-wa-preview-text">{previewText}</pre>
              </div>
            </div>
          </aside>
        </div>

        <div className="il-bulk-whatsapp-payment">
          <label className="us-field-label" htmlFor="bulk-payment-code">
            קוד רכישה
          </label>
          <input
            id="bulk-payment-code"
            className="us-field-input"
            value={paymentCode}
            onChange={(event) => setPaymentCode(event.target.value.toUpperCase())}
            placeholder="הזינו את הקוד שקיבלתם מהמנהל"
            required
            autoComplete="off"
          />
        </div>

        <p className="il-bulk-whatsapp-selected">
          נבחרו לשליחה: <strong>{selectedCount}</strong> מוזמנים
        </p>

        {error ? (
          <div className="il-bulk-whatsapp-alert" role="alert">
            <strong>שליחה נכשלה</strong>
            <p>{error}</p>
          </div>
        ) : null}
        {result ? (
          <div className="il-bulk-whatsapp-success-box" role="status">
            <p>{result}</p>
          </div>
        ) : null}

        <div className="us-toolbar mt-4">
          <button className="us-btn il-bulk-send-btn" type="submit" disabled={sending || !selectedCount}>
            {sending ? "שולח…" : `שליחה ל-${selectedCount} מוזמנים`}
          </button>
          <button className="us-btn" type="button" onClick={onClose}>
            סגירה
          </button>
        </div>
      </form>
    </div>
  );
}
