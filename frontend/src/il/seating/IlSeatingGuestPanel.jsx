import { useState } from "react";
import { Filter } from "lucide-react";
import { countGuestSeats, filterSeatingGuests } from "./ilSeatingUtils.js";

export default function IlSeatingGuestPanel({
  guests,
  filters,
  onFiltersChange,
  selectedGuestIds,
  onToggleGuest,
  onToggleAll,
  onDragStart,
  compact = false
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = filterSeatingGuests(guests, filters);
  const allSelected = filtered.length > 0 && filtered.every((guest) => selectedGuestIds.has(guest._id));
  const activeFilterCount = [filters.seated].filter(Boolean).length;

  return (
    <aside className={`il-seat-guest-panel${compact ? " is-compact" : ""}`} dir="rtl">
      <h3>אורחים להושבה</h3>
      {!compact ? (
        <p className="il-seat-guest-panel__hint">מסונכרן אוטומטית מ-RSVP (מגיע / אולי)</p>
      ) : null}

      <div className="il-seat-search-row">
        <input
          type="search"
          placeholder="חיפוש לפי שם או טלפון"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
          aria-label="חיפוש אורחים"
        />
        <button
          type="button"
          className={`il-seat-filter-toggle${filtersOpen || activeFilterCount ? " is-active" : ""}`}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-label="פתיחת מסננים"
          title="מסננים"
        >
          <Filter size={16} aria-hidden="true" />
          {activeFilterCount ? <em>{activeFilterCount}</em> : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="il-seat-filters il-seat-filters--drawer">
          <select
            value={filters.seated}
            onChange={(event) => onFiltersChange({ ...filters, seated: event.target.value })}
            aria-label="סינון לפי שיבוץ"
          >
            <option value="">כולם</option>
            <option value="floating">צפים (ללא שולחן)</option>
            <option value="seated">כבר הושבו</option>
          </select>
        </div>
      ) : null}

      <label className="il-seat-select-all">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} disabled={!filtered.length} />
        בחירת כל המוצגים ({filtered.length})
      </label>

      <ul className="il-seat-guest-list">
        {filtered.map((guest) => (
          <li
            key={guest._id}
            className={`il-seat-guest-item ${guest.isSeated ? "is-seated" : "is-floating"}${
              selectedGuestIds.has(guest._id) ? " is-selected" : ""
            }`}
            draggable
            onDragStart={(event) => onDragStart(event, guest._id)}
          >
            <label className="il-seat-guest-item__check">
              <input
                type="checkbox"
                checked={selectedGuestIds.has(guest._id)}
                onChange={() => onToggleGuest(guest._id)}
              />
            </label>
            <div className="il-seat-guest-item__main">
              <strong>{guest.fullName}</strong>
              <span>
                {countGuestSeats(guest)} מושבים ·{" "}
                {guest.isSeated ? `שולחן ${guest.tableLabel || "?"}` : "ממתין לשיבוץ"}
              </span>
              <span className="il-seat-guest-item__phone" dir="ltr">
                {guest.phone || "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
