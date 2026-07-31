import { useCallback, useEffect, useRef } from "react";

const EDGE_PX = 72;
const MAX_STEP = 32;

function scrollSpeed(distanceFromEdge) {
  const intensity = 1 - Math.max(0, Math.min(EDGE_PX, distanceFromEdge)) / EDGE_PX;
  return Math.max(6, Math.round(MAX_STEP * intensity));
}

function canScroll(el, axis) {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (axis === "y") {
    const overflowY = style.overflowY;
    if (!/(auto|scroll|overlay)/.test(overflowY)) return false;
    return el.scrollHeight > el.clientHeight + 1;
  }
  const overflowX = style.overflowX;
  if (!/(auto|scroll|overlay)/.test(overflowX)) return false;
  return el.scrollWidth > el.clientWidth + 1;
}

function collectScrollContainers(clientX, clientY) {
  const found = new Set();
  const under = document.elementFromPoint(clientX, clientY);
  let node = under;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      if (canScroll(node, "y") || canScroll(node, "x")) found.add(node);
    }
    node = node.parentElement;
  }

  document
    .querySelectorAll(".il-seat-canvas-wrap, .il-seat-guest-panel, .il-seat-page, .us-dashboard-content")
    .forEach((el) => {
      if (el instanceof HTMLElement && (canScroll(el, "y") || canScroll(el, "x"))) {
        found.add(el);
      }
    });

  return found;
}

function scrollElementNearPointer(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const nearHorizontally = clientX >= rect.left - EDGE_PX && clientX <= rect.right + EDGE_PX;
  const nearVertically = clientY >= rect.top - EDGE_PX && clientY <= rect.bottom + EDGE_PX;
  if (!nearHorizontally || !nearVertically) return;

  if (canScroll(el, "y")) {
    if (clientY < rect.top + EDGE_PX) {
      el.scrollTop -= scrollSpeed(clientY - rect.top);
    } else if (clientY > rect.bottom - EDGE_PX) {
      el.scrollTop += scrollSpeed(rect.bottom - clientY);
    }
  }

  if (canScroll(el, "x")) {
    if (clientX < rect.left + EDGE_PX) {
      el.scrollLeft -= scrollSpeed(clientX - rect.left);
    } else if (clientX > rect.right - EDGE_PX) {
      el.scrollLeft += scrollSpeed(rect.right - clientX);
    }
  }
}

function autoScrollFromPoint(clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  let windowDx = 0;
  let windowDy = 0;

  if (clientY < EDGE_PX) windowDy = -scrollSpeed(clientY);
  else if (clientY > vh - EDGE_PX) windowDy = scrollSpeed(vh - clientY);

  if (clientX < EDGE_PX) windowDx = -scrollSpeed(clientX);
  else if (clientX > vw - EDGE_PX) windowDx = scrollSpeed(vw - clientX);

  if (windowDx || windowDy) {
    window.scrollBy(windowDx, windowDy);
  }

  collectScrollContainers(clientX, clientY).forEach((el) => {
    scrollElementNearPointer(el, clientX, clientY);
  });
}

/**
 * Auto-scroll the page / seating canvases while an HTML5 guest drag is active.
 * Keeps scrolling via rAF using the last dragover pointer position near viewport edges.
 */
export function useSeatingDragAutoScroll() {
  const draggingRef = useRef(false);
  const pointRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  const stopDragAutoScroll = useCallback(() => {
    draggingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startDragAutoScroll = useCallback(
    (event) => {
      pointRef.current = {
        x: event?.clientX ?? window.innerWidth / 2,
        y: event?.clientY ?? window.innerHeight / 2
      };
      draggingRef.current = true;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const tick = () => {
        if (!draggingRef.current) return;
        autoScrollFromPoint(pointRef.current.x, pointRef.current.y);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  useEffect(() => {
    function onDragOver(event) {
      if (!draggingRef.current) return;
      pointRef.current = { x: event.clientX, y: event.clientY };
    }

    function onDragEnd() {
      stopDragAutoScroll();
    }

    document.addEventListener("dragover", onDragOver, { passive: true });
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("drop", onDragEnd);
    window.addEventListener("blur", onDragEnd);

    return () => {
      stopDragAutoScroll();
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("drop", onDragEnd);
      window.removeEventListener("blur", onDragEnd);
    };
  }, [stopDragAutoScroll]);

  return { startDragAutoScroll, stopDragAutoScroll };
}
