import { Trash2 } from "lucide-react";
import { countGuestSeats, formatTableDisplayLabel, getTableOccupancy } from "./ilSeatingUtils.js";

export default function IlSeatingTableDetail({
  table,
  guests,
  onClose,
  onUnassignGuest,
  onEditTable
}) {
  if (!table) return null;

  const seats = getTableOccupancy(guests, table.tableId);
  const tableGuests = guests.filter((guest) => guest.seatingTableId === table.tableId);
  const label = formatTableDisplayLabel(table);

  return (
    <aside className="il-seat-table-detail" dir="rtl" aria-live="polite">
      <div className="il-seat-table-detail__head">
        <div>
          <h3>שולחן {label}</h3>
          <p className="il-seat-table-detail__meta">
            {seats}/{table.capacity} מושבים
            {table.name ? ` · ${table.name}` : ""}
          </p>
        </div>
        <div className="il-seat-table-detail__actions">
          {onEditTable ? (
            <button type="button" className="us-btn" onClick={() => onEditTable(table.tableId)}>
              עריכה
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="il-seat-table-detail__close" onClick={onClose} aria-label="סגירה">
              ×
            </button>
          ) : null}
        </div>
      </div>

      {!tableGuests.length ? (
        <p className="il-seat-table-detail__empty">אין עדיין מוזמנים בשולחן זה</p>
      ) : (
        <ul className="il-seat-table-detail__list">
          {tableGuests.map((guest) => (
            <li key={guest._id} className="il-seat-table-detail__item">
              <div>
                <strong>{guest.fullName}</strong>
                <span>
                  {countGuestSeats(guest)} מושבים
                  {guest.phone ? ` · ${guest.phone}` : ""}
                </span>
              </div>
              {onUnassignGuest ? (
                <button
                  type="button"
                  className="il-seat-table-detail__remove"
                  onClick={() => onUnassignGuest(guest._id)}
                  aria-label={`החזרת ${guest.fullName} לרשימת הממתינים`}
                  title="החזרה לממתינים לשיבוץ"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
