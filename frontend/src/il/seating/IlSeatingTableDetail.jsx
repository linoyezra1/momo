import { Trash2 } from "lucide-react";
import { countGuestSeats, formatTableDisplayLabel, getTableOccupancy } from "./ilSeatingUtils.js";

function isGuestArrived(guest) {
  return guest?.status === "הגיע לאירוע" || Boolean(guest?.hostessArrivedAt);
}

export default function IlSeatingTableDetail({
  table,
  guests,
  onClose,
  onUnassignGuest,
  onEditTable,
  showArrivalStatus = false
}) {
  if (!table) return null;

  const seats = getTableOccupancy(guests, table.tableId);
  const capacity = Number(table.capacity) || 0;
  const isOverCapacity = seats > capacity;
  const tableGuests = guests.filter((guest) => guest.seatingTableId === table.tableId);
  const label = formatTableDisplayLabel(table);
  const arrivedCount = showArrivalStatus
    ? tableGuests.filter((guest) => isGuestArrived(guest)).length
    : 0;

  return (
    <aside
      className={`il-seat-table-detail${isOverCapacity ? " is-overfill" : ""}`}
      dir="rtl"
      aria-live="polite"
    >
      <div className="il-seat-table-detail__head">
        <div>
          <h3>שולחן {label}</h3>
          <p className={`il-seat-table-detail__meta${isOverCapacity ? " is-overfill" : ""}`}>
            {seats}/{capacity} מושבים
            {table.name ? ` · ${table.name}` : ""}
            {showArrivalStatus ? ` · הגיעו ${arrivedCount}/${tableGuests.length}` : ""}
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

      {isOverCapacity ? (
        <p className="il-seat-table-detail__overfill" role="status">
          השולחן קצת צפוף: הושבתם כאן {seats} מוזמנים במקום {capacity}
        </p>
      ) : null}

      {!tableGuests.length ? (
        <p className="il-seat-table-detail__empty">אין עדיין מוזמנים בשולחן זה</p>
      ) : (
        <ul className="il-seat-table-detail__list">
          {tableGuests.map((guest) => {
            const arrived = showArrivalStatus ? isGuestArrived(guest) : null;
            const seatCount = countGuestSeats(guest);
            return (
              <li
                key={guest._id}
                className={`il-seat-table-detail__item${
                  arrived === true ? " is-arrived" : arrived === false ? " is-pending" : ""
                }`}
              >
                <div>
                  <strong>{guest.fullName}</strong>
                  <span>
                    {seatCount} מושבים
                    {guest.phone ? ` · ${guest.phone}` : ""}
                    {showArrivalStatus ? (arrived ? " · הגיע" : " · טרם הגיע") : ""}
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
            );
          })}
        </ul>
      )}
    </aside>
  );
}
