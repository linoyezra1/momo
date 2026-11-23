/**
 * Interactive Gaia ("גאיה") hall simulation.
 * Background: /venue-halls/gaia.jpg (1142×888) — from אולם גאיה.png.
 * Drop zones sit over the drawn tables so guests can be dragged onto them.
 */

const hallAssetBase = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export const GAIA_HALL = {
  id: "gaia-v2",
  name: "גאיה",
  backgroundImageUrl: `${hallAssetBase}venue-halls/gaia.jpg`,
  canvasWidth: 1142,
  canvasHeight: 888
};

function table({ label, shape, capacity, x, y, width, height }) {
  return {
    tableId: `gaia_tbl_${label}`,
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

/** Pixel positions calibrated to landscape אולם גאיה.png (1142×888). */
export function buildGaiaLayout() {
  const sq = 96;
  return {
    backgroundImageUrl: GAIA_HALL.backgroundImageUrl,
    canvasWidth: GAIA_HALL.canvasWidth,
    canvasHeight: GAIA_HALL.canvasHeight,
    hallPresetId: GAIA_HALL.id,
    venueElements: [],
    tables: [
      // Near dance floor / DJ
      table({ label: 13, shape: "head", capacity: 22, x: 70, y: 250, width: 280, height: 88 }),
      table({ label: 27, shape: "head", capacity: 12, x: 760, y: 250, width: 250, height: 88 }),

      // Second row
      table({ label: 10, shape: "rect", capacity: 12, x: 90, y: 370, width: sq, height: sq }),
      table({ label: 11, shape: "rect", capacity: 12, x: 230, y: 370, width: sq, height: sq }),
      table({ label: 25, shape: "rect", capacity: 12, x: 760, y: 370, width: sq, height: sq }),
      table({ label: 26, shape: "rect", capacity: 12, x: 900, y: 370, width: sq, height: sq }),

      // Third row
      table({ label: 7, shape: "rect", capacity: 12, x: 60, y: 500, width: sq, height: sq }),
      table({ label: 8, shape: "rect", capacity: 12, x: 180, y: 500, width: sq, height: sq }),
      table({ label: 9, shape: "rect", capacity: 12, x: 300, y: 500, width: sq, height: sq }),
      table({ label: 21, shape: "rect", capacity: 12, x: 700, y: 500, width: sq, height: sq }),
      table({ label: 22, shape: "rect", capacity: 12, x: 820, y: 500, width: sq, height: sq }),
      table({ label: 23, shape: "rect", capacity: 12, x: 940, y: 500, width: sq, height: sq }),

      // Fourth row
      table({ label: 4, shape: "rect", capacity: 12, x: 90, y: 630, width: sq, height: sq }),
      table({ label: 5, shape: "rect", capacity: 12, x: 230, y: 630, width: sq, height: sq }),
      table({ label: 19, shape: "rect", capacity: 12, x: 760, y: 630, width: sq, height: sq }),
      table({ label: 20, shape: "rect", capacity: 12, x: 900, y: 630, width: sq, height: sq }),

      // Bottom row
      table({ label: 6, shape: "rect", capacity: 12, x: 160, y: 750, width: sq, height: sq }),
      table({ label: 18, shape: "rect", capacity: 12, x: 760, y: 750, width: sq, height: sq }),
      table({ label: 24, shape: "rect", capacity: 12, x: 900, y: 750, width: sq, height: sq })
    ]
  };
}
