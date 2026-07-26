import { useEffect, useMemo, useState } from "react";
import { Contact, QrCode, X } from "lucide-react";
import {
  isContactsPickerSupported,
  isLikelyValidIsraeliMobile,
  mapDeviceContactsToReviewRows,
  pickContactsFromDevice
} from "../utils/contactsImport.js";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize.js";

/**
 * @param {{
 *   userId: string,
 *   existingPhones: string[],
 *   onClose: () => void,
 *   onImported: (result: { insertedCount: number }) => void,
 *   onRequestExcelImport: () => void,
 *   importContacts: (guests: Array<{fullName: string, phone: string, guestGroup: string}>) => Promise<{insertedCount: number}>
 * }} props
 */
export default function ContactImportModal({
  userId,
  existingPhones,
  onClose,
  onImported,
  onRequestExcelImport,
  importContacts
}) {
  const supported = useMemo(() => isContactsPickerSupported(), []);
  const [step, setStep] = useState(supported ? "idle" : "unsupported");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const dashboardUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/client/dashboard/${userId}`
      : "";

  const qrUrl = dashboardUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(dashboardUrl)}`
    : "";

  const selectedCount = rows.filter((row) => row.selected && !row.isDuplicate && !row.isInvalidPhone).length;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openPicker = async () => {
    setError("");
    try {
      const contacts = await pickContactsFromDevice();
      const mapped = mapDeviceContactsToReviewRows(contacts, existingPhones);
      if (!mapped.length) {
        setError("לא נבחרו אנשי קשר");
        return;
      }
      setRows(mapped);
      setStep("review");
    } catch (pickError) {
      if (pickError?.code === "ABORTED") return;
      if (pickError?.code === "UNSUPPORTED") {
        setStep("unsupported");
        return;
      }
      if (pickError?.code === "DENIED") {
        setError("הגישה לאנשי הקשר נחסמה. אפשר לאשר הרשאה בהגדרות הדפדפן ולנסות שוב.");
        return;
      }
      if (pickError?.code === "EMPTY") {
        setError("לא נבחרו אנשי קשר");
        return;
      }
      setError(pickError?.message || "פתיחת אנשי הקשר נכשלה");
    }
  };

  const updateRow = (id, patch) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, "phone")) {
          const phone = normalizeIsraeliPhone(patch.phone);
          next.phone = phone;
          next.isInvalidPhone = !phone || !isLikelyValidIsraeliMobile(phone);
          const existingSet = new Set(
            (existingPhones || []).map((item) => normalizeIsraeliPhone(item)).filter(Boolean)
          );
          const others = prev.filter((item) => item.id !== id && item.selected).map((item) => item.phone);
          next.isDuplicate =
            Boolean(phone) && (existingSet.has(phone) || others.includes(phone));
          if (next.isDuplicate || next.isInvalidPhone) next.selected = false;
        }
        return next;
      })
    );
  };

  const toggleRow = (id) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (row.isDuplicate || row.isInvalidPhone) return { ...row, selected: false };
        return { ...row, selected: !row.selected };
      })
    );
  };

  const toggleAllValid = () => {
    const selectable = rows.filter((row) => !row.isDuplicate && !row.isInvalidPhone);
    const allSelected = selectable.length > 0 && selectable.every((row) => row.selected);
    setRows((prev) =>
      prev.map((row) => {
        if (row.isDuplicate || row.isInvalidPhone) return { ...row, selected: false };
        return { ...row, selected: !allSelected };
      })
    );
  };

  const confirmImport = async () => {
    const payload = rows
      .filter((row) => row.selected && !row.isDuplicate && !row.isInvalidPhone)
      .map((row) => ({
        fullName: row.fullName.trim(),
        phone: row.phone,
        guestGroup: ""
      }))
      .filter((row) => row.fullName && row.phone);

    if (!payload.length) {
      setError("יש לבחור לפחות מוזמן תקין לייבוא");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await importContacts(payload);
      setToast(`יובאו ${result.insertedCount || payload.length} מוזמנים בהצלחה`);
      onImported?.(result);
      window.setTimeout(() => onClose?.(), 700);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || saveError?.message || "ייבוא אנשי הקשר נכשל");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="us-modal-backdrop" role="presentation" dir="rtl" lang="he">
      <div
        className="us-modal-card il-contacts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contacts-import-title"
      >
        <div className="il-contacts-modal__head">
          <h2 id="contacts-import-title" className="us-modal-title">
            {step === "review" ? "סקירת אנשי קשר לייבוא" : "ייבוא מאנשי קשר"}
          </h2>
          <button type="button" className="us-btn" onClick={onClose} aria-label="סגירה">
            <X size={16} />
          </button>
        </div>

        {error ? <p className="us-error-message">{error}</p> : null}
        {toast ? <p className="il-contacts-toast" role="status">{toast}</p> : null}

        {step === "idle" ? (
          <div className="il-contacts-idle">
            <p>בחרו אנשי קשר מהטלפון, עברו על הרשימה, ואז ייבאו למערכת.</p>
            <button className="us-btn us-btn--primary il-contacts-primary-btn" type="button" onClick={openPicker}>
              <Contact size={16} aria-hidden="true" />
              בחירת אנשי קשר
            </button>
          </div>
        ) : null}

        {step === "unsupported" ? (
          <div className="il-contacts-fallback">
            <p>
              ייבוא מאנשי קשר זמין בעיקר בטלפונים ניידים (Chrome / Edge ב־Android).
              במחשב אפשר לסרוק QR ולהמשיך מהטלפון, או להעלות קובץ אקסל.
            </p>
            {qrUrl ? (
              <div className="il-contacts-qr">
                <img src={qrUrl} alt="QR לפתיחת הדשבורד במובייל" width={180} height={180} />
                <span>
                  <QrCode size={14} aria-hidden="true" /> סריקה מהטלפון
                </span>
              </div>
            ) : null}
            <div className="us-toolbar">
              <button
                className="us-btn us-btn--primary"
                type="button"
                onClick={() => {
                  onRequestExcelImport?.();
                  onClose?.();
                }}
              >
                העלאת מוזמנים מאקסל
              </button>
              <button className="us-btn" type="button" onClick={onClose}>
                סגירה
              </button>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <>
            <div className="il-contacts-review-toolbar">
              <label className="il-contacts-select-all">
                <input
                  type="checkbox"
                  checked={
                    rows.filter((row) => !row.isDuplicate && !row.isInvalidPhone).length > 0 &&
                    rows
                      .filter((row) => !row.isDuplicate && !row.isInvalidPhone)
                      .every((row) => row.selected)
                  }
                  onChange={toggleAllValid}
                />
                בחירת כל התקינים
              </label>
            </div>

            <div className="il-contacts-review-list">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className={`il-contacts-review-row${row.isDuplicate ? " is-duplicate" : ""}${
                    row.isInvalidPhone ? " is-invalid" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={row.isDuplicate || row.isInvalidPhone}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`בחירת ${row.fullName}`}
                  />
                  <div className="il-contacts-review-fields">
                    <input
                      className="us-field-input"
                      value={row.fullName}
                      onChange={(event) => updateRow(row.id, { fullName: event.target.value })}
                      aria-label="שם מוזמן"
                    />
                    <input
                      className="us-field-input"
                      dir="ltr"
                      value={row.phone}
                      onChange={(event) => updateRow(row.id, { phone: event.target.value })}
                      aria-label="טלפון"
                    />
                    <div className="il-contacts-review-tags">
                      {row.isDuplicate ? <span className="il-contacts-tag is-warn">קיים במערכת</span> : null}
                      {row.isInvalidPhone ? <span className="il-contacts-tag is-error">טלפון לא תקין</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="us-toolbar mt-4">
              <button
                className="us-btn us-btn--primary"
                type="button"
                disabled={saving || !selectedCount}
                onClick={confirmImport}
              >
                {saving ? "מייבא…" : `ייבא ${selectedCount} מוזמנים למערכת`}
              </button>
              <button className="us-btn" type="button" onClick={openPicker} disabled={saving}>
                בחירה מחדש
              </button>
              <button className="us-btn" type="button" onClick={onClose} disabled={saving}>
                ביטול
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
