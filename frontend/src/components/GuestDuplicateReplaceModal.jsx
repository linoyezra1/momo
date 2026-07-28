import { buildGuestDuplicateMessage, formatGuestDuplicateStatus } from "../utils/guestDuplicate.js";

export default function GuestDuplicateReplaceModal({
  existing,
  incoming,
  onConfirm,
  onCancel,
  submitting = false,
  title = "המוזמן כבר קיים במערכת"
}) {
  if (!existing || !incoming) return null;

  const message = buildGuestDuplicateMessage({ existing, incoming });

  return (
    <div className="us-modal-backdrop" role="presentation" dir="rtl" lang="he">
      <div className="us-modal-card" role="dialog" aria-modal="true" aria-labelledby="guest-duplicate-title">
        <h2 id="guest-duplicate-title" className="us-modal-title">
          {title}
        </h2>

        <p className="us-login-subtitle us-login-subtitle--left">{message}</p>

        <div className="us-conflict-card mt-4">
          <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="us-dashboard-emphasis">קיים במערכת:</span>
              <div>
                {existing.fullName} · {formatGuestDuplicateStatus(existing)}
              </div>
            </div>
            <div>
              <span className="us-dashboard-emphasis">חדש:</span>
              <div>
                {incoming.fullName} · {Math.max(1, Number(incoming.attendeesCount) || 1)} מגיעים
              </div>
            </div>
          </div>
        </div>

        <div className="us-toolbar mt-4">
          <button className="us-btn us-btn--primary" type="button" disabled={submitting} onClick={onConfirm}>
            {submitting ? "שומר…" : "אישור להחלפה"}
          </button>
          <button className="us-btn" type="button" disabled={submitting} onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
