import { useEffect, useMemo, useState } from "react";
import { countGuestSeats } from "./ilSeatingUtils.js";

export default function IlSeatingTablePanel({
  table,
  guests,
  unassignedGuests,
  onClose,
  onRenameTable,
  onCapacityChange,
  onUnassignGuest,
  onAssignGuest
}) {
  const [search, setSearch] = useState("");
  const [pickedGuestId, setPickedGuestId] = useState("");

  const assignedGuests = useMemo(
    () => guests.filter((guest) => guest.seatingTableId === table?.tableId && guest.isEligible),
    [guests, table?.tableId]
  );

  const occupiedSeats = useMemo(
    () => assignedGuests.reduce((sum, guest) => sum + countGuestSeats(guest), 0),
    [assignedGuests]
  );

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unassignedGuests.slice(0, 8);
    return unassignedGuests
      .filter(
        (guest) =>
          String(guest.fullName || "").toLowerCase().includes(q) ||
          String(guest.phone || "").includes(q) ||
          String(guest.guestGroup || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, unassignedGuests]);

  useEffect(() => {
    setSearch("");
    setPickedGuestId("");
  }, [table?.tableId]);

  if (!table) return null;

  function assignPicked() {
    const guestId = pickedGuestId || suggestions[0]?._id;
    if (!guestId) return;
    onAssignGuest(guestId);
    setSearch("");
    setPickedGuestId("");
  }

  return (
    <aside className="il-seat-table-panel" dir="rtl">
      <div className="il-seat-table-panel__header">
        <h3>פרטי שולחן</h3>
        <button type="button" className="il-seat-table-panel__close" onClick={onClose} aria-label="סגירה">
          ×
        </button>
      </div>

      <label className="il-seat-table-panel__field">
        שם השולחן
        <input
          value={table.label}
          onChange={(event) => onRenameTable(event.target.value)}
          placeholder="לדוגמה: 5 / משפחה"
        />
      </label>

      <label className="il-seat-table-panel__field">
        קיבולת כיסאות
        <input
          type="number"
          min="1"
          value={table.capacity}
          onChange={(event) => onCapacityChange(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>

      <p className="il-seat-table-panel__occupancy">
        תפוסה: <strong>{occupiedSeats}</strong> / {table.capacity} כיסאות
      </p>

      <div className="il-seat-table-panel__assign">
        <span className="il-seat-table-panel__section-title">שיבוץ מהיר</span>
        <div className="il-seat-table-panel__assign-row">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPickedGuestId("");
            }}
            placeholder="חיפוש אורח לא משובץ…"
            list={`il-seat-suggest-${table.tableId}`}
          />
          <datalist id={`il-seat-suggest-${table.tableId}`}>
            {suggestions.map((guest) => (
              <option key={guest._id} value={guest.fullName} />
            ))}
          </datalist>
          <button
            type="button"
            className="us-btn us-btn--primary"
            onClick={assignPicked}
            disabled={!pickedGuestId && !suggestions.length}
            title="שיבוץ לשולחן"
          >
            +
          </button>
        </div>
        {suggestions.length ? (
          <ul className="il-seat-table-panel__suggestions">
            {suggestions.map((guest) => (
              <li key={guest._id}>
                <button
                  type="button"
                  className={pickedGuestId === guest._id ? "is-picked" : ""}
                  onClick={() => {
                    setPickedGuestId(guest._id);
                    setSearch(guest.fullName);
                  }}
                >
                  <strong>{guest.fullName}</strong>
                  <span>
                    {countGuestSeats(guest)} כיסאות
                    {guest.guestGroup ? ` · ${guest.guestGroup}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="il-seat-table-panel__empty">אין אורחים תואמים לשיבוץ</p>
        )}
      </div>

      <div className="il-seat-table-panel__guests">
        <span className="il-seat-table-panel__section-title">אורחים משובצים ({assignedGuests.length})</span>
        {assignedGuests.length === 0 ? (
          <p className="il-seat-table-panel__empty">אין אורחים בשולחן זה</p>
        ) : (
          <ul>
            {assignedGuests.map((guest) => (
              <li key={guest._id}>
                <div>
                  <strong>{guest.fullName}</strong>
                  <span>
                    {countGuestSeats(guest)} כיסאות
                    {guest.guestGroup ? ` · ${guest.guestGroup}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="il-seat-table-panel__remove"
                  onClick={() => onUnassignGuest(guest._id)}
                  aria-label={`הסרת ${guest.fullName}`}
                  title="הסרה מהשולחן"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
