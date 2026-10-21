import { buildShaloshLayout, SHALOSH_HALL } from "./shalosh.js";

/**
 * Hall simulations in inventory.
 * Matched only when event.venueName equals the preset name exactly.
 */
const HALL_PRESETS = [
  {
    ...SHALOSH_HALL,
    buildLayout: buildShaloshLayout
  }
];

export function normalizeVenueName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveHallPresetByVenueName(venueName) {
  const normalized = normalizeVenueName(venueName);
  if (!normalized) return null;
  return HALL_PRESETS.find((preset) => normalizeVenueName(preset.name) === normalized) || null;
}

export { SHALOSH_HALL, buildShaloshLayout };
