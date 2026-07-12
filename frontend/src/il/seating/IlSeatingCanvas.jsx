import { Rnd } from "react-rnd";
import { VENUE_ELEMENT_LABELS } from "./seatingConstants.js";
import { countGuestSeats, getTableOccupancy } from "./ilSeatingUtils.js";

function tableClass(shape, isOver, isDropTarget) {
  const parts = ["il-seat-table", `il-seat-table--${shape}`];
  if (isOver) parts.push("il-seat-table--over");
  if (isDropTarget) parts.push("il-seat-table--target");
  return parts.join(" ");
}

function ChairRing({ capacity, occupied }) {
  const seats = Math.max(1, Number(capacity) || 1);
  const taken = Math.max(0, Math.min(seats, Number(occupied) || 0));
  const radius = 42;

  return (
    <div className="il-seat-chairs" aria-hidden="true">
      {Array.from({ length: seats }, (_, index) => {
        const angle = (Math.PI * 2 * index) / seats - Math.PI / 2;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        const isTaken = index < taken;
        return (
          <span
            key={index}
            className={`il-seat-chair ${isTaken ? "il-seat-chair--taken" : "il-seat-chair--free"}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            title={isTaken ? "תפוס" : "פנוי"}
          />
        );
      })}
    </div>
  );
}

export default function IlSeatingCanvas({
  tables,
  venueElements,
  guests,
  warnings,
  activeTableId,
  onLayoutChange,
  onSelectTable,
  onDropGuestsOnTable,
  canvasRef
}) {
  const warningByTable = new Map(warnings.map((warning) => [warning.tableId, warning]));

  function updateTable(tableId, patch) {
    onLayoutChange({
      tables: tables.map((table) => (table.tableId === tableId ? { ...table, ...patch } : table))
    });
  }

  function updateElement(elementId, patch) {
    onLayoutChange({
      venueElements: venueElements.map((element) =>
        element.elementId === elementId ? { ...element, ...patch } : element
      )
    });
  }

  return (
    <div className="il-seat-canvas-wrap">
      <div className="il-seat-canvas" dir="ltr" ref={canvasRef} id="il-seating-canvas-export">
        {venueElements.map((element) => (
          <Rnd
            key={element.elementId}
            size={{ width: element.width, height: element.height }}
            position={{ x: element.x, y: element.y }}
            bounds="parent"
            onDragStop={(_e, data) => updateElement(element.elementId, { x: data.x, y: data.y })}
            onResizeStop={(_e, _dir, ref, _delta, position) =>
              updateElement(element.elementId, {
                width: ref.offsetWidth,
                height: ref.offsetHeight,
                x: position.x,
                y: position.y
              })
            }
            className={`il-seat-venue il-seat-venue--${element.type}`}
          >
            <span>{element.label || VENUE_ELEMENT_LABELS[element.type]}</span>
          </Rnd>
        ))}

        {tables.map((table) => {
          const seats = getTableOccupancy(guests, table.tableId);
          const warning = warningByTable.get(table.tableId);
          const isOver = seats > table.capacity;
          const tableGuests = guests.filter((guest) => guest.seatingTableId === table.tableId);

          return (
            <Rnd
              key={table.tableId}
              size={{ width: Math.max(table.width, 110), height: Math.max(table.height, 110) }}
              position={{ x: table.x, y: table.y }}
              bounds="parent"
              onDragStop={(_e, data) => updateTable(table.tableId, { x: data.x, y: data.y })}
              onResizeStop={(_e, _dir, ref, _delta, position) =>
                updateTable(table.tableId, {
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                  x: position.x,
                  y: position.y
                })
              }
              className={tableClass(table.shape, isOver, activeTableId === table.tableId)}
              onClick={() => onSelectTable(table.tableId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const payload = event.dataTransfer.getData("application/json");
                if (!payload) return;
                try {
                  const { guestIds } = JSON.parse(payload);
                  onDropGuestsOnTable(table.tableId, guestIds);
                } catch {
                  /* ignore */
                }
              }}
            >
              <ChairRing capacity={table.capacity} occupied={seats} />
              <div className="il-seat-table__inner">
                <strong>{table.label}</strong>
                <span>
                  {seats}/{table.capacity}
                </span>
                {tableGuests.length ? (
                  <em className="il-seat-table__names">
                    {tableGuests
                      .slice(0, 2)
                      .map((guest) => `${guest.fullName} (${countGuestSeats(guest)})`)
                      .join(" · ")}
                    {tableGuests.length > 2 ? "…" : ""}
                  </em>
                ) : null}
                {warning ? <em className="il-seat-table__warn">{warning.type === "overfill" ? "!" : "…"}</em> : null}
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
