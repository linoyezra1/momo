import { Rnd } from "react-rnd";
import { VENUE_ELEMENT_LABELS } from "./seatingConstants.js";
import { getTableOccupancy } from "./ilSeatingUtils.js";

function tableClass(shape, isOver, isDropTarget) {
  const parts = ["il-seat-table", `il-seat-table--${shape}`];
  if (isOver) parts.push("il-seat-table--over");
  if (isDropTarget) parts.push("il-seat-table--target");
  return parts.join(" ");
}

export default function IlSeatingCanvas({
  tables,
  venueElements,
  guests,
  warnings,
  activeTableId,
  onLayoutChange,
  onSelectTable,
  onDropGuestsOnTable
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
      <div className="il-seat-canvas" dir="ltr">
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

          return (
            <Rnd
              key={table.tableId}
              size={{ width: table.width, height: table.height }}
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
              <div className="il-seat-table__inner">
                <strong>{table.label}</strong>
                <span>
                  {seats}/{table.capacity}
                </span>
                {warning ? <em className="il-seat-table__warn">{warning.type === "overfill" ? "!" : "…"}</em> : null}
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
