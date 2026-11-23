/**
 * Interactive Basico ("באסיקו") hall simulation.
 * Background: /venue-halls/basico.jpg (1190×1684) — rendered from באסיקו.pdf.
 * Drop zones sit over the drawn tables so guests can be dragged onto them.
 */

const hallAssetBase = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export const BASICO_HALL = {
  id: "basico",
  name: "באסיקו",
  backgroundImageUrl: `${hallAssetBase}venue-halls/basico.jpg`,
  canvasWidth: 1190,
  canvasHeight: 1684
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

/** Center a drop zone on a PDF label (coordinates already scaled ×2 to match basico.jpg). */
function zone(label, cx, cy, width, height, shape, capacity) {
  return table({
    label,
    shape,
    capacity,
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2 + 10),
    width,
    height
  });
}

/** Pixel positions calibrated from באסיקו.pdf text coordinates. */
export function buildBasicoLayout() {
  const round = 96;
  const square = 100;
  const side = { w: 118, h: 72 };
  const long = { w: 200, h: 78 };

  return {
    backgroundImageUrl: BASICO_HALL.backgroundImageUrl,
    canvasWidth: BASICO_HALL.canvasWidth,
    canvasHeight: BASICO_HALL.canvasHeight,
    hallPresetId: BASICO_HALL.id,
    venueElements: [],
    tables: [
      // Far-left rectangular column (1–8)
      zone(8, 356, 318, side.w, side.h, "rect", 12),
      zone(7, 356, 427, side.w, side.h, "rect", 12),
      zone(6, 356, 542, side.w, side.h, "rect", 12),
      zone(5, 356, 657, side.w, side.h, "rect", 12),
      zone(4, 356, 772, side.w, side.h, "rect", 12),
      zone(3, 356, 887, side.w, side.h, "rect", 12),
      zone(2, 356, 1002, side.w, side.h, "rect", 12),
      zone(1, 356, 1117, side.w, side.h, "rect", 12),

      // Inner-left column (9–15)
      zone(9, 436, 378, round, round, "round", 11),
      zone(10, 436, 479, square, square, "rect", 12),
      zone(11, 436, 587, square, square, "rect", 12),
      zone(12, 436, 702, square, square, "rect", 12),
      zone(13, 436, 817, square, square, "rect", 12),
      zone(14, 436, 933, square, square, "rect", 12),
      zone(15, 436, 1079, long.w, long.h, "head", 22),

      // Center column (22, 21–16)
      zone(22, 585, 350, side.w, side.h, "rect", 12),
      zone(21, 528, 442, round, round, "round", 11),
      zone(20, 528, 552, round, round, "round", 11),
      zone(19, 528, 662, round, round, "round", 11),
      zone(18, 528, 772, round, round, "round", 11),
      zone(17, 528, 891, square, square, "rect", 12),
      zone(16, 528, 1047, long.w, long.h, "head", 22),

      // Inner-right column (23–28)
      zone(23, 643, 442, round, round, "round", 11),
      zone(24, 643, 552, round, round, "round", 11),
      zone(25, 643, 662, round, round, "round", 11),
      zone(26, 643, 772, round, round, "round", 11),
      zone(27, 643, 891, square, square, "rect", 12),
      zone(28, 643, 1051, long.w, long.h, "head", 22),

      // Far-right column (35–29)
      zone(35, 747, 318, side.w, side.h, "rect", 12),
      zone(34, 747, 442, side.w, side.h, "rect", 12),
      zone(33, 747, 573, side.w, side.h, "rect", 12),
      zone(32, 747, 693, side.w, side.h, "rect", 12),
      zone(31, 747, 813, side.w, side.h, "rect", 12),
      zone(30, 747, 933, side.w, side.h, "rect", 12),
      zone(29, 747, 1079, long.w, long.h, "head", 22)
    ]
  };
}
