import { countGuestSeats, getTableOccupancy } from "./ilSeatingUtils.js";
import { Pencil, UserMinus } from "lucide-react";

export default function IlSeatingSimpleGrid({
  tables,
  guests,
  activeTableId,
  onSelectTable,
  onEditTable,
  onDropGuestsOnTable,
  onUnassignGuest
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
        const seatedGuests = guests.filter((guest) => guest.seatingTableId === table.tableId);
        const isActive = activeTableId === table.tableId;
        const isOverfill = occupied > Number(table.capacity || 0);

        return (
          <article
            key={table.tableId}
            className={`il-seat-table-card${isActive ? " is-active" : ""}${isOverfill ? " is-overfill" : ""}`}
            role="listitem"
            title={isOverfill ? "חריגה מקיבולת השולחן" : undefined}
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
                    <li
                      key={guest._id}
                      className={guest.isDeclinedWhileSeated ? "is-declined" : undefined}
                      title={guest.declinedWhileSeatedLabel || undefined}
                    >
                      <div className="il-seat-table-card__guest-main">
                        <strong>
                          {guest.fullName}
                          {guest.isDeclinedWhileSeated ? (
                            <em className="il-seat-decline-badge" aria-label={guest.declinedWhileSeatedLabel}>
                              !
                            </em>
                          ) : null}
                        </strong>
                        <span className="il-seat-table-card__guest-phone" dir="ltr">
                          {guest.phone || "—"}
                        </span>
                      </div>
                      <div className="il-seat-table-card__guest-actions">
                        <span className="il-seat-table-card__guest-seats" title="מספר מושבים תפוסים">
                          {countGuestSeats(guest)}
                        </span>
                        {onUnassignGuest ? (
                          <button
                            type="button"
                            className="il-seat-table-card__unassign"
                            aria-label={`הסרת ${guest.fullName} מהשולחן`}
                            title="הסרה מהושבה — חזרה לצפים"
                            onClick={(event) => {
                              event.stopPropagation();
                              onUnassignGuest(guest._id);
                            }}
                          >
                            <UserMinus size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
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
