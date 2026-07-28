import { useEffect, useMemo, useState } from "react";
import { Contact, QrCode, X } from "lucide-react";
import ContactsDuplicateResolveModal from "./ContactsDuplicateResolveModal.jsx";
import {
  isContactsPickerSupported,
  isLikelyValidIsraeliMobile,
  mapDeviceContactsToReviewRows,
  pickContactsFromDevice
} from "../utils/contactsImport.js";
import { indexGuestsByPhone } from "../utils/guestDuplicate.js";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize.js";

/**
 * @param {{
 *   userId: string,
 *   existingGuests: Array<{_id?: string, fullName?: string, phone?: string, attendeesCount?: number, status?: string, source?: string}>,
 *   onClose: () => void,
 *   onImported: (result: { insertedCount: number, replacedCount?: number }) => void,
 *   onRequestExcelImport: () => void,
 *   importContacts: (
 *     guests: Array<{fullName: string, phone: string, guestGroup: string}>,
 *     options?: { replacePhones?: string[] }
 *   ) => Promise<{insertedCount: number, replacedCount?: number}>
 * }} props
 */
export default function ContactImportModal({
  userId,
  existingGuests,
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
  const [duplicateConflicts, setDuplicateConflicts] = useState([]);
  const [duplicateChoices, setDuplicateChoices] = useState({});

  const existingByPhone = useMemo(() => indexGuestsByPhone(existingGuests || []), [existingGuests]);

  const dashboardUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/client/dashboard/${userId}`
      : "";

  const qrUrl = dashboardUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(dashboardUrl)}`
    : "";

  const isRowSelectable = (row) => !row.isBatchDuplicate && !row.isInvalidPhone;

  const selectedCount = rows.filter((row) => row.selected && isRowSelectable(row)).length;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openPicker = async () => {
    setError("");
    setDuplicateConflicts([]);
    setDuplicateChoices({});
    try {
      const contacts = await pickContactsFromDevice();
      const mapped = mapDeviceContactsToReviewRows(contacts, existingGuests);
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
          const others = prev.filter((item) => item.id !== id && item.selected).map((item) => item.phone);
          const existingGuest = phone ? existingByPhone.get(phone) || null : null;
          next.isExistingDuplicate = Boolean(existingGuest);
          next.isBatchDuplicate = Boolean(phone) && others.includes(phone);
          next.isDuplicate = next.isExistingDuplicate || next.isBatchDuplicate;
          next.existingGuest = existingGuest;
          if (next.isBatchDuplicate || next.isInvalidPhone) next.selected = false;
        }
        return next;
      })
    );
  };

  const toggleRow = (id) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (!isRowSelectable(row)) return { ...row, selected: false };
        return { ...row, selected: !row.selected };
      })
    );
  };

  const toggleAllValid = () => {
    const selectable = rows.filter((row) => isRowSelectable(row));
    const allSelected = selectable.length > 0 && selectable.every((row) => row.selected);
    setRows((prev) =>
      prev.map((row) => {
        if (!isRowSelectable(row)) return { ...row, selected: false };
        return { ...row, selected: !allSelected };
      })
    );
  };

  const buildPayload = () =>
    rows
      .filter((row) => row.selected && isRowSelectable(row))
      .map((row) => ({
        fullName: row.fullName.trim(),
        phone: row.phone,
        guestGroup: ""
      }))
      .filter((row) => row.fullName && row.phone);

  const buildConflictsFromPayload = (payload) =>
    payload
      .map((row) => {
        const existing = existingByPhone.get(row.phone);
        if (!existing) return null;
        return {
          phone: row.phone,
          existing,
          incoming: {
            fullName: row.fullName,
            attendeesCount: 1
          }
        };
      })
      .filter(Boolean);

  const runImport = async (payload, replacePhones = []) => {
    setSaving(true);
    setError("");
    try {
      const result = await importContacts(payload, { replacePhones });
      const inserted = Number(result.insertedCount || 0);
      const replaced = Number(result.replacedCount || 0);
      const parts = [];
      if (inserted > 0) parts.push(`יובאו ${inserted}`);
      if (replaced > 0) parts.push(`הוחלפו ${replaced}`);
      setToast(parts.length ? `${parts.join(", ")} בהצלחה` : "הייבוא הושלם");
      onImported?.(result);
      window.setTimeout(() => onClose?.(), 700);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || saveError?.message || "ייבוא אנשי הקשר נכשל");
    } finally {
      setSaving(false);
      setDuplicateConflicts([]);
      setDuplicateChoices({});
    }
  };

  const confirmImport = async () => {
    const payload = buildPayload();
    if (!payload.length) {
      setError("יש לבחור לפחות מוזמן תקין לייבוא");
      return;
    }

    const conflicts = buildConflictsFromPayload(payload);
    if (conflicts.length) {
      const initialChoices = {};
      conflicts.forEach((item) => {
        initialChoices[item.phone] = "skip";
      });
      setDuplicateChoices(initialChoices);
      setDuplicateConflicts(conflicts);
      return;
    }

    await runImport(payload);
  };

  const confirmDuplicateResolutions = async () => {
    const payload = buildPayload();
    const replacePhones = duplicateConflicts
      .filter((item) => duplicateChoices[item.phone] === "replace")
      .map((item) => item.phone);
    await runImport(payload, replacePhones);
  };

  const closeDuplicateResolve = () => {
    setDuplicateConflicts([]);
    setDuplicateChoices({});
  };

  const setDuplicateChoice = (phone, choice) => {
    setDuplicateChoices((prev) => ({ ...prev, [phone]: choice }));
  };

  if (duplicateConflicts.length) {
    return (
      <ContactsDuplicateResolveModal
        conflicts={duplicateConflicts}
        choices={duplicateChoices}
        onChoiceChange={setDuplicateChoice}
        onConfirm={confirmDuplicateResolutions}
        onCancel={closeDuplicateResolve}
        submitting={saving}
      />
    );
  }

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
                    rows.filter((row) => isRowSelectable(row)).length > 0 &&
                    rows.filter((row) => isRowSelectable(row)).every((row) => row.selected)
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
                  className={`il-contacts-review-row${row.isExistingDuplicate ? " is-duplicate" : ""}${
                    row.isBatchDuplicate ? " is-batch-duplicate" : ""
                  }${row.isInvalidPhone ? " is-invalid" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={!isRowSelectable(row)}
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
                      {row.isExistingDuplicate ? (
                        <span className="il-contacts-tag is-warn">קיים במערכת — יוצג אישור החלפה</span>
                      ) : null}
                      {row.isBatchDuplicate ? (
                        <span className="il-contacts-tag is-warn">כפילות ברשימת הייבוא</span>
                      ) : null}
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
