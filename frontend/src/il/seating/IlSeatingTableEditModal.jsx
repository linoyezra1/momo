import { useEffect, useMemo, useState } from "react";
import { countGuestSeats, formatTableDisplayLabel } from "./ilSeatingUtils.js";

export default function IlSeatingTableEditModal({
  table,
  guests,
  onClose,
  onSave,
  onDelete
}) {
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");

  const tableId = table?.tableId || "";

  const assignedGuests = useMemo(
    () =>
      guests.filter(
        (guest) => guest.seatingTableId === tableId && (guest.isEligible || guest.isDeclinedWhileSeated || guest.isSeated)
      ),
    [guests, tableId]
  );

  const occupiedSeats = useMemo(
    () => assignedGuests.reduce((sum, guest) => sum + countGuestSeats(guest), 0),
    [assignedGuests]
  );

  const hasAssignedGuests = assignedGuests.length > 0;
  const capacityNumber = Math.max(1, Number(capacity) || 1);

  // Sync only when opening a different table — never while typing an empty name.
  useEffect(() => {
    if (!tableId || !table) return;
    setLabel(table.label ?? "");
    setName(table.name ?? "");
    setCapacity(String(Math.max(1, Number(table.capacity) || 1)));
  }, [tableId]);

  if (!table) return null;

  function handleSave(event) {
    event?.preventDefault?.();
    const nextLabel = String(label ?? "").trim();
    const nextName = String(name ?? "").trim();
    onSave({
      label: nextLabel || String(table.label || "").trim() || "1",
      name: nextName,
      capacity: capacityNumber
    });
  }

  function handleBackdropPointerDown(event) {
    if (event.target === event.currentTarget) onClose();
  }

  const previewLabel = formatTableDisplayLabel({
    label: String(label ?? "").trim() || table.label || "1",
    name: String(name ?? "").trim()
  });

  return (
    <div
      className="il-seat-modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropPointerDown}
    >
      <form
        className="il-seat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="il-seat-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSave}
      >
        <header className="il-seat-modal__header">
          <h2 id="il-seat-modal-title">עריכת שולחן</h2>
          <span className="il-seat-modal__badge">{previewLabel}</span>
        </header>

        <label className="il-seat-modal__field">
          <span>מספר השולחן</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="לדוגמה: 12"
            autoComplete="off"
          />
        </label>

        <label className="il-seat-modal__field">
          <span>שם השולחן</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="לדוגמה: חברות"
            autoComplete="off"
          />
        </label>

        <p className="il-seat-modal__hint">
          בהודעת WhatsApp יופיע:{" "}
          <strong>
            {String(name ?? "").trim()
              ? `${String(name).trim()} שולחן מס ${String(label ?? "").trim() || table.label || "1"}`
              : `שולחן מס ${String(label ?? "").trim() || table.label || "1"}`}
          </strong>
        </p>

        <label className="il-seat-modal__field">
          <span>מספר כיסאות נוכחי:</span>
          <input
            className="il-money-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={capacity}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              setCapacity(raw);
            }}
          />
        </label>

        <p className="il-seat-modal__occupancy">
          תפוסה נוכחית: <strong>{occupiedSeats}</strong> / {capacityNumber}
        </p>

        <p className="il-seat-modal__hint">לא ניתן למחוק שולחן שיש בו מוזמנים</p>

        <div className="il-seat-modal__actions">
          <button type="submit" className="il-seat-modal__btn il-seat-modal__btn--primary">
            שמירת שינויים
          </button>
          <button
            type="button"
            className="il-seat-modal__btn il-seat-modal__btn--danger"
            onClick={onDelete}
            disabled={hasAssignedGuests}
            title={hasAssignedGuests ? "לא ניתן למחוק שולחן שיש בו מוזמנים" : "מחיקת שולחן"}
          >
            מחיקת שולחן
          </button>
          <button type="button" className="il-seat-modal__btn il-seat-modal__btn--secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
