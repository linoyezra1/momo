import { countGuestSeats, getTableOccupancy } from "./ilSeatingUtils.js";
import { Pencil } from "lucide-react";

export default function IlSeatingSimpleGrid({
  tables,
  guests,
  activeTableId,
  onSelectTable,
  onEditTable,
  onDropGuestsOnTable
}) {
  function handleDrop(event, tableId) {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/json") || "{}");
      const guestIds = Array.isArray(payload.guestIds) ? payload.guestIds : [];
      if (guestIds.length) onDropGuestsOnTable(tableId, guestIds);
    } catch {
      /* ignore malformed drag payloads */
    }
  }

  if (!tables.length) {
    return (
      <div className="il-seat-simple-empty">
        <p>עדיין אין שולחנות. הוסיפו שולחן מהסרגל למעלה.</p>
      </div>
    );
  }

  return (
    <div className="il-seat-simple-grid" role="list">
      {tables.map((table) => {
        const occupied = getTableOccupancy(guests, table.tableId);
        const seatedGuests = guests.filter(
          (guest) => guest.seatingTableId === table.tableId && guest.isEligible
        );
        const isActive = activeTableId === table.tableId;

        return (
          <article
            key={table.tableId}
            className={`il-seat-table-card${isActive ? " is-active" : ""}`}
            role="listitem"
            onClick={() => onSelectTable(table.tableId)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, table.tableId)}
          >
            <header className="il-seat-table-card__header">
              <div>
                <h3>שולחן {table.label}</h3>
                <span className="il-seat-table-card__capacity">
                  {occupied} / {table.capacity}
                </span>
              </div>
              <button
                type="button"
                className="il-seat-table-card__edit"
                aria-label={`עריכת שולחן ${table.label}`}
                title="עריכת שולחן"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditTable(table.tableId);
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="il-seat-table-card__dropzone">
              {seatedGuests.length ? (
                <ul className="il-seat-table-card__guests">
                  {seatedGuests.map((guest) => (
                    <li key={guest._id}>
                      <div className="il-seat-table-card__guest-main">
                        <strong>{guest.fullName}</strong>
                        <span className="il-seat-table-card__guest-phone" dir="ltr">
                          {guest.phone || "—"}
                        </span>
                      </div>
                      <span className="il-seat-table-card__guest-seats" title="מספר מושבים תפוסים">
                        {countGuestSeats(guest)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="il-seat-table-card__placeholder">גררו לכאן</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
