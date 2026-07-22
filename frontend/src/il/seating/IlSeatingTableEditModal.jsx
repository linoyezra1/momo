import { useEffect, useMemo, useState } from "react";
import { countGuestSeats } from "./ilSeatingUtils.js";

export default function IlSeatingTableEditModal({
  table,
  guests,
  onClose,
  onSave,
  onDelete
}) {
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("");

  const assignedGuests = useMemo(
    () => guests.filter((guest) => guest.seatingTableId === table?.tableId && guest.isEligible),
    [guests, table?.tableId]
  );

  const occupiedSeats = useMemo(
    () => assignedGuests.reduce((sum, guest) => sum + countGuestSeats(guest), 0),
    [assignedGuests]
  );

  const hasAssignedGuests = assignedGuests.length > 0;
  const capacityNumber = Math.max(1, Number(capacity) || 1);

  useEffect(() => {
    if (!table) return;
    setLabel(table.label || "");
    setCapacity(String(Math.max(1, Number(table.capacity) || 1)));
  }, [table]);

  if (!table) return null;

  function handleSave() {
    onSave({
      label: String(label || "").trim() || table.label,
      capacity: capacityNumber
    });
  }

  return (
    <div className="il-seat-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="il-seat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="il-seat-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="il-seat-modal__header">
          <h2 id="il-seat-modal-title">עריכת שולחן</h2>
          <span className="il-seat-modal__badge">שולחן מספר {table.label}</span>
        </header>

        <label className="il-seat-modal__field">
          <span>שם אופציונלי לשולחן</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="...שם אופציונלי לשולחן"
          />
        </label>

        <label className="il-seat-modal__field">
          <span>מספר כיסאות נוכחי:</span>
          <input
            className="il-money-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={capacity === "" ? "" : capacity}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              if (raw === "") {
                setCapacity("");
                return;
              }
              setCapacity(Math.max(1, Number(raw) || 1));
            }}
          />
        </label>

        <p className="il-seat-modal__occupancy">
          תפוסה נוכחית: <strong>{occupiedSeats}</strong> / {capacityNumber}
        </p>

        <p className="il-seat-modal__hint">לא ניתן למחוק שולחן שיש בו מוזמנים</p>

        <div className="il-seat-modal__actions">
          <button type="button" className="il-seat-modal__btn il-seat-modal__btn--primary" onClick={handleSave}>
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
      </div>
    </div>
  );
}
