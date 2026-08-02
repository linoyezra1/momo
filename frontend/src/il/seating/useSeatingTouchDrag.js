import { useCallback, useEffect, useRef, useState } from "react";

const MOVE_THRESHOLD_PX = 10;

function findDropTableId(clientX, clientY) {
  const ghosts = document.querySelectorAll(".il-seat-touch-ghost");
  ghosts.forEach((node) => {
    node.style.visibility = "hidden";
  });
  const under = document.elementFromPoint(clientX, clientY);
  ghosts.forEach((node) => {
    node.style.visibility = "";
  });
  const dropTarget = under?.closest?.("[data-seating-drop-table-id]");
  return dropTarget?.getAttribute?.("data-seating-drop-table-id") || "";
}

/**
 * Pointer/touch drag for seating assignment on mobile.
 * Mouse continues to use native HTML5 DnD; this handles touch/pen.
 */
export function useSeatingTouchDrag({ resolveGuestIds, onDropGuestsOnTable, onDragActiveChange }) {
  const [touchDrag, setTouchDrag] = useState(null);
  const sessionRef = useRef(null);

  const clearSession = useCallback(() => {
    sessionRef.current = null;
    setTouchDrag(null);
    onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  useEffect(() => {
    function onPointerMove(event) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      if (!session.dragging) {
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) return;
        session.dragging = true;
        onDragActiveChange?.(true);
        try {
          event.target?.setPointerCapture?.(event.pointerId);
        } catch {
          /* ignore */
        }
      }

      event.preventDefault();
      const overTableId = findDropTableId(event.clientX, event.clientY);
      setTouchDrag({
        guestIds: session.guestIds,
        x: event.clientX,
        y: event.clientY,
        overTableId
      });
    }

    function onPointerUp(event) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      if (session.dragging) {
        const tableId = findDropTableId(event.clientX, event.clientY);
        if (tableId && session.guestIds?.length) {
          onDropGuestsOnTable?.(tableId, session.guestIds);
        }
      }
      clearSession();
    }

    function onPointerCancel(event) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      clearSession();
    }

    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [clearSession, onDragActiveChange, onDropGuestsOnTable]);

  const onGuestPointerDown = useCallback(
    (event, guestId) => {
      if (event.pointerType === "mouse") return;
      if (event.button != null && event.button !== 0) return;
      const interactive = event.target?.closest?.("input, button, a, label, select, textarea");
      if (interactive) return;
      const guestIds = resolveGuestIds?.(guestId) || [guestId];
      sessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        guestIds,
        dragging: false
      };
    },
    [resolveGuestIds]
  );

  return { touchDrag, onGuestPointerDown };
}
