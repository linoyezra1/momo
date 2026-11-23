/**
 * Interactive Basico ("באסיקו") hall simulation.
 * Background: /venue-halls/basico.jpg (1380×984) — from באסיקו.png (landscape).
 * Drop zones sit over the drawn tables so guests can be dragged onto them.
 */

const hallAssetBase = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export const BASICO_HALL = {
  id: "basico-v2",
  name: "באסיקו",
  backgroundImageUrl: `${hallAssetBase}venue-halls/basico.jpg`,
  canvasWidth: 1380,
  canvasHeight: 984
};

function table({ label, shape, capacity, x, y, width, height }) {
  return {
    tableId: `basico_tbl_${label}`,
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

/** Center a drop zone on a table label. */
function zone(label, cx, cy, width, height, shape, capacity) {
  return table({
    label,
    shape,
    capacity,
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2),
    width,
    height
  });
}

/**
 * Pixel positions calibrated to landscape באסיקו.png (upscaled 2×).
 * Derived from PDF label coords rotated 90° CCW and scaled to 1380×984.
 */
export function buildBasicoLayout() {
  const round = 72;
  const square = 76;
  const rect = { w: 100, h: 58 };
  const long = { w: 150, h: 56 };

  return {
    backgroundImageUrl: BASICO_HALL.backgroundImageUrl,
    canvasWidth: BASICO_HALL.canvasWidth,
    canvasHeight: BASICO_HALL.canvasHeight,
    hallPresetId: BASICO_HALL.id,
    venueElements: [],
    tables: [
      // Top row (near brick wall / checkered border)
      zone(35, 261, 366, square, square, "rect", 12),
      zone(34, 362, 366, rect.w, rect.h, "rect", 12),
      zone(33, 470, 366, rect.w, rect.h, "rect", 12),
      zone(32, 568, 366, rect.w, rect.h, "rect", 12),
      zone(31, 666, 366, rect.w, rect.h, "rect", 12),
      zone(30, 765, 366, rect.w, rect.h, "rect", 12),
      zone(29, 884, 366, long.w, long.h, "head", 22),

      // Second from top
      zone(23, 362, 452, round, round, "round", 11),
      zone(24, 452, 452, round, round, "round", 11),
      zone(25, 543, 452, round, round, "round", 11),
      zone(26, 633, 452, round, round, "round", 11),
      zone(27, 730, 452, rect.w, rect.h, "rect", 12),
      zone(28, 861, 452, long.w, long.h, "head", 22),

      // Middle row
      zone(22, 287, 500, square, square, "rect", 12),
      zone(21, 362, 547, round, round, "round", 11),
      zone(20, 452, 547, round, round, "round", 11),
      zone(19, 543, 547, round, round, "round", 11),
      zone(18, 633, 547, round, round, "round", 11),
      zone(17, 730, 547, rect.w, rect.h, "rect", 12),
      zone(16, 858, 547, long.w, long.h, "head", 22),

      // Second from bottom
      zone(9, 310, 624, round, round, "round", 11),
      zone(10, 393, 624, square, square, "rect", 12),
      zone(11, 481, 624, rect.w, rect.h, "rect", 12),
      zone(12, 575, 624, rect.w, rect.h, "rect", 12),
      zone(13, 670, 624, rect.w, rect.h, "rect", 12),
      zone(14, 765, 624, rect.w, rect.h, "rect", 12),
      zone(15, 884, 624, long.w, long.h, "head", 22),

      // Bottom row (near foyer)
      zone(8, 261, 690, square, square, "rect", 12),
      zone(7, 350, 690, rect.w, rect.h, "rect", 12),
      zone(6, 444, 690, rect.w, rect.h, "rect", 12),
      zone(5, 538, 690, rect.w, rect.h, "rect", 12),
      zone(4, 633, 690, rect.w, rect.h, "rect", 12),
      zone(3, 727, 690, rect.w, rect.h, "rect", 12),
      zone(2, 821, 690, rect.w, rect.h, "rect", 12),
      zone(1, 915, 690, rect.w, rect.h, "rect", 12)
    ]
  };
}
