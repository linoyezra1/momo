/**
 * Interactive Everest hall simulation.
 * Background: /venue-halls/everest.jpg (1024×563).
 * Drop zones sit over the drawn tables so guests can be dragged onto them.
 */

export const EVEREST_HALL = {
  id: "everest",
  name: "אוורסט",
  backgroundImageUrl: "/venue-halls/everest.jpg",
  canvasWidth: 1024,
  canvasHeight: 563
};

function table({ label, shape, capacity, x, y, width, height }) {
  return {
    tableId: `everest_tbl_${label}`,
    label: String(label),
    name: "",
    shape,
    capacity,
    x,
    y,
    width,
    height
  };
}

/** Pixel positions calibrated to everest.jpg */
export function buildEverestLayout() {
  return {
    backgroundImageUrl: EVEREST_HALL.backgroundImageUrl,
    canvasWidth: EVEREST_HALL.canvasWidth,
    canvasHeight: EVEREST_HALL.canvasHeight,
    hallPresetId: EVEREST_HALL.id,
    venueElements: [],
    tables: [
      // Top rectangular cluster (white chairs in sketch)
      table({ label: 1, shape: "rect", capacity: 12, x: 78, y: 42, width: 118, height: 72 }),
      table({ label: 2, shape: "rect", capacity: 12, x: 78, y: 128, width: 118, height: 72 }),
      table({ label: 3, shape: "rect", capacity: 12, x: 215, y: 85, width: 118, height: 72 }),
      table({ label: 5, shape: "rect", capacity: 20, x: 300, y: 38, width: 188, height: 78 }),
      table({ label: 6, shape: "rect", capacity: 20, x: 300, y: 132, width: 188, height: 78 }),
      table({ label: 4, shape: "rect", capacity: 12, x: 510, y: 42, width: 118, height: 72 }),
      table({ label: 7, shape: "rect", capacity: 12, x: 640, y: 42, width: 118, height: 72 }),
      table({ label: 8, shape: "rect", capacity: 12, x: 575, y: 128, width: 118, height: 72 }),

      // Bottom round cluster (black chairs in sketch)
      table({ label: 9, shape: "round", capacity: 12, x: 62, y: 268, width: 98, height: 98 }),
      table({ label: 10, shape: "round", capacity: 12, x: 62, y: 385, width: 98, height: 98 }),
      table({ label: 11, shape: "round", capacity: 12, x: 175, y: 268, width: 98, height: 98 }),
      table({ label: 12, shape: "round", capacity: 12, x: 175, y: 385, width: 98, height: 98 }),
      table({ label: 13, shape: "round", capacity: 12, x: 288, y: 290, width: 98, height: 98 }),
      table({ label: 14, shape: "round", capacity: 12, x: 288, y: 405, width: 98, height: 98 }),
      table({ label: 15, shape: "round", capacity: 12, x: 470, y: 290, width: 98, height: 98 }),
      table({ label: 17, shape: "round", capacity: 12, x: 470, y: 405, width: 98, height: 98 }),
      table({ label: 16, shape: "round", capacity: 12, x: 590, y: 268, width: 98, height: 98 }),
      table({ label: 18, shape: "round", capacity: 12, x: 590, y: 385, width: 98, height: 98 })
    ]
  };
}
