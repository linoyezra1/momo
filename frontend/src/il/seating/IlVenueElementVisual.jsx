import { VENUE_ELEMENT_LABELS } from "./seatingConstants.js";

function DanceIcon() {
  return (
    <svg className="il-seat-venue__icon" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="4" y="4" width="56" height="32" rx="4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeDasharray="4 3" />
      <circle cx="22" cy="20" r="3.5" fill="currentColor" opacity="0.55" />
      <circle cx="42" cy="20" r="3.5" fill="currentColor" opacity="0.55" />
      <path d="M26 20c4-6 8-6 12 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DjIcon() {
  return (
    <svg className="il-seat-venue__icon" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="8" y="14" width="48" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="22" cy="22" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="42" cy="22" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 8v6M28 10h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChuppahIcon() {
  return (
    <svg className="il-seat-venue__icon" viewBox="0 0 64 40" aria-hidden="true">
      <path d="M10 18 L32 6 L54 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M14 18v16M50 18v16M32 18v16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 34h28" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
    </svg>
  );
}

function StageBarIcon() {
  return (
    <svg className="il-seat-venue__icon" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="6" y="12" width="52" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 12v-4h36v4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="21" r="2" fill="currentColor" opacity="0.45" />
      <circle cx="32" cy="21" r="2" fill="currentColor" opacity="0.45" />
      <circle cx="44" cy="21" r="2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function LegacyIcon() {
  return (
    <svg className="il-seat-venue__icon" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="10" y="10" width="44" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

const ICONS = {
  dance: DanceIcon,
  dj: DjIcon,
  chuppah: ChuppahIcon,
  stage_bar: StageBarIcon,
  stage: StageBarIcon,
  bar: StageBarIcon,
  pillar: LegacyIcon
};

export default function IlVenueElementVisual({ type, label }) {
  const Icon = ICONS[type] || LegacyIcon;
  const text = label || VENUE_ELEMENT_LABELS[type] || type;

  return (
    <div className="il-seat-venue__content">
      <Icon />
      <span className="il-seat-venue__label">{text}</span>
    </div>
  );
}
