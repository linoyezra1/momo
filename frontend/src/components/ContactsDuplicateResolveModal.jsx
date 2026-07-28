import { formatGuestDuplicateStatus } from "../utils/guestDuplicate.js";

export default function ContactsDuplicateResolveModal({
  conflicts = [],
  choices = {},
  onChoiceChange,
  onConfirm,
  onCancel,
  submitting = false
}) {
  if (!conflicts.length) return null;

  return (
    <div className="us-modal-backdrop" role="presentation" dir="rtl" lang="he">
      <div className="us-modal-card il-contacts-modal" role="dialog" aria-modal="true" aria-labelledby="contacts-duplicate-title">
        <h2 id="contacts-duplicate-title" className="us-modal-title">
          המוזמן כבר קיים במערכת
        </h2>
        <p className="us-login-subtitle us-login-subtitle--left">
          נמצאו {conflicts.length} אנשי קשר עם מספר טלפון שכבר קיים במערכת. בחרו לכל אחד האם להחליף או לדלג.
        </p>

        <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {conflicts.map((item) => {
            const choice = choices[item.phone] || "skip";
            const existingStatus = formatGuestDuplicateStatus(item.existing);
            const incomingCount = Math.max(1, Number(item.incoming?.attendeesCount) || 1);

            return (
              <div key={item.phone} className="us-conflict-card">
                <p className="us-dashboard-emphasis text-sm" dir="ltr">
                  {item.phone}
                </p>
                <p className="mt-2 text-sm">
                  המוזמן {item.existing.fullName} כבר קיים במערכת עם מספר טלפון זה (סטטוס: {existingStatus}).
                  האם אתה בטוח שברצונך להחליף אותו ב-{item.incoming.fullName} עם כמות מגיעים של {incomingCount}?
                </p>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <label>
                    <input
                      type="radio"
                      name={`contact-dup-${item.phone}`}
                      checked={choice === "skip"}
                      onChange={() => onChoiceChange(item.phone, "skip")}
                    />{" "}
                    דלג — השאר את הקיים
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`contact-dup-${item.phone}`}
                      checked={choice === "replace"}
                      onChange={() => onChoiceChange(item.phone, "replace")}
                    />{" "}
                    אישור להחלפה
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="us-toolbar mt-4">
          <button className="us-btn us-btn--primary" type="button" disabled={submitting} onClick={onConfirm}>
            {submitting ? "מייבא…" : "המשך ייבוא"}
          </button>
          <button className="us-btn" type="button" disabled={submitting} onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
