import { useLayoutEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { Pencil, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import IlVenueElementVisual from "./IlVenueElementVisual.jsx";
import { formatTableDisplayLabel, getTableOccupancy } from "./ilSeatingUtils.js";

function tableClass(shape, isOver, isDropTarget, isSearchHit = false) {
  const parts = ["il-seat-table", `il-seat-table--${shape}`];
  if (isOver) parts.push("il-seat-table--over");
  if (isDropTarget) parts.push("il-seat-table--target");
  if (isSearchHit) parts.push("il-seat-table--search-hit");
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
  highlightTableId = "",
  searchHighlightTableId = "",
  searchHighlightTableIds = null,
  onLayoutChange,
  onSelectTable,
  onDragOverTable,
  onEditTable,
  onDropGuestsOnTable,
  canvasRef,
  readOnly = false,
  touchOverTableId = "",
  backgroundImageUrl = "",
  canvasWidth = 0,
  canvasHeight = 0,
  hallPresetId = ""
}) {
  const wrapRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  const warningByTable = new Map(warnings.map((warning) => [warning.tableId, warning]));
  const hasHallBackground = Boolean(String(backgroundImageUrl || "").trim());
  const baseWidth = Number(canvasWidth) || 0;
  const baseHeight = Number(canvasHeight) || 0;
  const scale = hasHallBackground && baseWidth > 0 ? fitScale : 1;

  useLayoutEffect(() => {
    if (!hasHallBackground || baseWidth <= 0) {
      setFitScale(1);
      return undefined;
    }
    const el = wrapRef.current;
    if (!el) return undefined;

    const update = () => {
      const styles = window.getComputedStyle(el);
      const padX =
        (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
      const available = Math.max(0, el.clientWidth - padX);
      const next = available > 0 ? available / baseWidth : 1;
      setFitScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [baseWidth, baseHeight, hasHallBackground]);

  function toView(value) {
    return Number(value || 0) * scale;
  }

  function fromView(value) {
    if (!scale) return Number(value || 0);
    return Number(value || 0) / scale;
  }

  const canvasStyle = {
    ...(hasHallBackground
      ? {
          ["--il-hall-bg-image"]: `url("${String(backgroundImageUrl).replace(/"/g, "%22")}")`,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          // Keep the full hall image visible at container width (no horizontal scroll).
          aspectRatio: baseWidth > 0 && baseHeight > 0 ? `${baseWidth} / ${baseHeight}` : undefined,
          height: baseHeight > 0 ? Math.round(baseHeight * scale) : undefined
        }
      : {
          ...(baseWidth > 0 ? { width: baseWidth, minWidth: baseWidth } : {}),
          ...(baseHeight > 0 ? { height: baseHeight, minHeight: baseHeight } : {})
        })
  };

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

  function setCanvasNode(node) {
    if (typeof canvasRef === "function") {
      canvasRef(node);
    } else if (canvasRef && typeof canvasRef === "object") {
      canvasRef.current = node;
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`il-seat-canvas-wrap${readOnly ? " is-readonly" : ""}${hasHallBackground ? " is-hall-sim" : ""}`}
    >
      <div
        className={`il-seat-canvas${hasHallBackground ? " il-seat-canvas--hall" : ""}`}
        dir="ltr"
        ref={setCanvasNode}
        id="il-seating-canvas-export"
        data-hall-preset={hallPresetId || undefined}
        style={canvasStyle}
      >
        {venueElements.map((element) => {
          const rotation = normalizeRotation(element.rotation);
          return (
            <Rnd
              key={element.elementId}
              size={{ width: toView(element.width), height: toView(element.height) }}
              position={{ x: toView(element.x), y: toView(element.y) }}
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
              onDragStop={(_e, data) =>
                updateElement(element.elementId, { x: fromView(data.x), y: fromView(data.y) })
              }
              onResizeStop={(_e, _dir, ref, _delta, position) =>
                updateElement(element.elementId, {
                  width: fromView(ref.offsetWidth),
                  height: fromView(ref.offsetHeight),
                  x: fromView(position.x),
                  y: fromView(position.y)
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
          const isOverCapacity = seats > table.capacity;
          const isDropTarget =
            highlightTableId === table.tableId || touchOverTableId === table.tableId;
          const isSearchHit =
            searchHighlightTableId === table.tableId ||
            (Array.isArray(searchHighlightTableIds) &&
              searchHighlightTableIds.includes(table.tableId));
          const isActive = activeTableId === table.tableId && !isDropTarget && !isSearchHit;
          const minW = hasHallBackground ? 72 : 110;
          const minH = hasHallBackground ? 56 : 110;

          return (
            <Rnd
              key={table.tableId}
              size={{
                width: Math.max(toView(table.width), toView(minW)),
                height: Math.max(toView(table.height), toView(minH))
              }}
              position={{ x: toView(table.x), y: toView(table.y) }}
              bounds="parent"
              disableDragging={readOnly}
              enableResizing={!readOnly}
              onDragStop={(_e, data) =>
                updateTable(table.tableId, { x: fromView(data.x), y: fromView(data.y) })
              }
              onResizeStop={(_e, _dir, ref, _delta, position) =>
                updateTable(table.tableId, {
                  width: fromView(ref.offsetWidth),
                  height: fromView(ref.offsetHeight),
                  x: fromView(position.x),
                  y: fromView(position.y)
                })
              }
              className={`${tableClass(table.shape, isOverCapacity, isDropTarget, isSearchHit)}${
                isActive ? " il-seat-table--active" : ""
              }${hasHallBackground ? " il-seat-table--hall-overlay" : ""}`}
              data-seating-drop-table-id={table.tableId}
              onClick={() => onSelectTable?.(table.tableId)}
              onDragEnter={(event) => {
                if (readOnly) return;
                event.preventDefault();
                onDragOverTable?.(table.tableId);
              }}
              onDragOver={(event) => {
                if (readOnly) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                onDragOverTable?.(table.tableId);
              }}
              onDragLeave={(event) => {
                if (readOnly) return;
                const next = event.relatedTarget;
                if (next && event.currentTarget.contains(next)) return;
                onDragOverTable?.("");
              }}
              onDrop={(event) => {
                if (readOnly) return;
                event.preventDefault();
                onDragOverTable?.("");
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
              {hasHallBackground ? null : <ChairRing capacity={table.capacity} occupied={seats} />}
              {!readOnly ? (
                <button
                  type="button"
                  className="il-seat-table__edit"
                  aria-label={`עריכת שולחן ${formatTableDisplayLabel(table)}`}
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
                <strong>{formatTableDisplayLabel(table)}</strong>
                <span>
                  {seats}/{table.capacity}
                </span>
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
