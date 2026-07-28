import { Rnd } from "react-rnd";
import { Pencil, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import IlVenueElementVisual from "./IlVenueElementVisual.jsx";
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

function normalizeRotation(value) {
  const deg = ((Number(value) || 0) % 360) + 360;
  return deg % 360;
}

export default function IlSeatingCanvas({
  tables,
  venueElements,
  guests,
  warnings,
  activeTableId,
  onLayoutChange,
  onSelectTable,
  onEditTable,
  onDropGuestsOnTable,
  canvasRef,
  readOnly = false
}) {
  const warningByTable = new Map(warnings.map((warning) => [warning.tableId, warning]));

  function updateTable(tableId, patch) {
    if (readOnly) return;
    onLayoutChange({
      tables: tables.map((table) => (table.tableId === tableId ? { ...table, ...patch } : table))
    });
  }

  function updateElement(elementId, patch) {
    if (readOnly) return;
    onLayoutChange({
      venueElements: venueElements.map((element) =>
        element.elementId === elementId ? { ...element, ...patch } : element
      )
    });
  }

  function removeElement(elementId) {
    if (readOnly) return;
    onLayoutChange({
      venueElements: venueElements.filter((element) => element.elementId !== elementId)
    });
  }

  function rotateElement(elementId, delta) {
    if (readOnly) return;
    const current = venueElements.find((element) => element.elementId === elementId);
    if (!current) return;
    updateElement(elementId, { rotation: normalizeRotation((current.rotation || 0) + delta) });
  }

  return (
    <div className={`il-seat-canvas-wrap${readOnly ? " is-readonly" : ""}`}>
      <div className="il-seat-canvas" dir="ltr" ref={canvasRef} id="il-seating-canvas-export">
        {venueElements.map((element) => {
          const rotation = normalizeRotation(element.rotation);
          return (
            <Rnd
              key={element.elementId}
              size={{ width: element.width, height: element.height }}
              position={{ x: element.x, y: element.y }}
              bounds="parent"
              disableDragging={readOnly}
              enableResizing={
                readOnly
                  ? false
                  : {
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true
                    }
              }
              onDragStop={(_e, data) => updateElement(element.elementId, { x: data.x, y: data.y })}
              onResizeStop={(_e, _dir, ref, _delta, position) =>
                updateElement(element.elementId, {
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                  x: position.x,
                  y: position.y
                })
              }
              className={`il-seat-venue il-seat-venue--${element.type}${readOnly ? " is-readonly" : ""}`}
            >
              <div className="il-seat-venue__body" style={{ transform: `rotate(${rotation}deg)` }}>
                <IlVenueElementVisual type={element.type} label={element.label} />
              </div>
              {!readOnly ? (
                <div className="il-seat-venue__toolbar" onMouseDown={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="il-seat-venue__tool"
                    title="סובב שמאלה"
                    aria-label="סובב שמאלה"
                    onClick={() => rotateElement(element.elementId, -15)}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="il-seat-venue__tool"
                    title="סובב ימינה"
                    aria-label="סובב ימינה"
                    onClick={() => rotateElement(element.elementId, 15)}
                  >
                    <RotateCw size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="il-seat-venue__tool il-seat-venue__tool--danger"
                    title="מחק אלמנט"
                    aria-label="מחק אלמנט"
                    onClick={() => removeElement(element.elementId)}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </Rnd>
          );
        })}

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
              disableDragging={readOnly}
              enableResizing={!readOnly}
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
              onClick={() => onSelectTable?.(table.tableId)}
              onDragOver={(event) => {
                if (readOnly) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (readOnly) return;
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
              {!readOnly ? (
                <button
                  type="button"
                  className="il-seat-table__edit"
                  aria-label={`עריכת שולחן ${table.label}`}
                  title="עריכת שולחן"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditTable?.(table.tableId);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              ) : null}
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
                    {tableGuests.length > 2 ? ` +${tableGuests.length - 2}` : ""}
                  </em>
                ) : null}
                {warning?.type === "overfill" ? (
                  <em className="il-seat-table__warn" title={warning.message}>
                    !
                  </em>
                ) : null}
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
