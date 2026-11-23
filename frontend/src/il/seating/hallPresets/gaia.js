/**
 * Interactive Gaia ("גאיה") hall simulation.
 * Background: /venue-halls/gaia.jpg (1544×1919).
 * Drop zones sit over the drawn tables so guests can be dragged onto them.
 */

const hallAssetBase = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export const GAIA_HALL = {
  id: "gaia",
  name: "גאיה",
  backgroundImageUrl: `${hallAssetBase}venue-halls/gaia.jpg`,
  canvasWidth: 1544,
  canvasHeight: 1919
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

/** Pixel positions calibrated to gaia.jpg */
export function buildGaiaLayout() {
  return {
    backgroundImageUrl: GAIA_HALL.backgroundImageUrl,
    canvasWidth: GAIA_HALL.canvasWidth,
    canvasHeight: GAIA_HALL.canvasHeight,
    hallPresetId: GAIA_HALL.id,
    venueElements: [],
    tables: [
      // Top cluster (near stairs / upper end of hall)
      table({ label: 6, shape: "rect", capacity: 12, x: 110, y: 150, width: 140, height: 140 }),
      table({ label: 4, shape: "rect", capacity: 12, x: 290, y: 90, width: 140, height: 140 }),
      table({ label: 5, shape: "rect", capacity: 12, x: 290, y: 270, width: 140, height: 140 }),
      table({ label: 7, shape: "rect", capacity: 12, x: 490, y: 90, width: 140, height: 140 }),
      table({ label: 8, shape: "rect", capacity: 12, x: 490, y: 270, width: 140, height: 140 }),
      table({ label: 9, shape: "rect", capacity: 12, x: 490, y: 450, width: 140, height: 140 }),
      table({ label: 10, shape: "rect", capacity: 12, x: 700, y: 90, width: 140, height: 140 }),
      table({ label: 11, shape: "rect", capacity: 12, x: 700, y: 270, width: 140, height: 140 }),
      table({ label: 13, shape: "head", capacity: 22, x: 920, y: 140, width: 420, height: 150 }),

      // Mid cluster (around dance floor / DJ side)
      table({ label: 25, shape: "rect", capacity: 12, x: 700, y: 620, width: 140, height: 140 }),
      table({ label: 26, shape: "rect", capacity: 12, x: 880, y: 620, width: 140, height: 140 }),
      table({ label: 27, shape: "head", capacity: 12, x: 1080, y: 780, width: 320, height: 140 }),
      table({ label: 21, shape: "rect", capacity: 12, x: 160, y: 720, width: 140, height: 140 }),
      table({ label: 22, shape: "rect", capacity: 12, x: 340, y: 720, width: 140, height: 140 }),
      table({ label: 23, shape: "rect", capacity: 12, x: 520, y: 720, width: 140, height: 140 }),

      // Lower cluster (toward bar / lower stairs)
      table({ label: 18, shape: "rect", capacity: 12, x: 160, y: 980, width: 140, height: 140 }),
      table({ label: 19, shape: "rect", capacity: 12, x: 340, y: 980, width: 140, height: 140 }),
      table({ label: 20, shape: "rect", capacity: 12, x: 520, y: 980, width: 140, height: 140 }),
      table({ label: 24, shape: "rect", capacity: 12, x: 250, y: 1220, width: 140, height: 140 })
    ]
  };
}
