import { useState } from "react";
import { Filter } from "lucide-react";
import { GUEST_GROUPS, GUEST_SIDES } from "./seatingConstants.js";
import { filterSeatingGuests } from "./ilSeatingUtils.js";

export default function IlSeatingGuestPanel({
  guests,
  filters,
  onFiltersChange,
  selectedGuestIds,
  onToggleGuest,
  onToggleAll,
  onGuestMetaChange,
  onDragStart,
  compact = false
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = filterSeatingGuests(guests, filters);
  const allSelected = filtered.length > 0 && filtered.every((guest) => selectedGuestIds.has(guest._id));
  const activeFilterCount = [filters.side, filters.group, filters.seated].filter(Boolean).length;

  return (
    <aside className={`il-seat-guest-panel${compact ? " is-compact" : ""}`}>
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
            value={filters.side}
            onChange={(event) => onFiltersChange({ ...filters, side: event.target.value })}
            aria-label="סינון לפי צד"
          >
            <option value="">כל הצדדים</option>
            {GUEST_SIDES.filter(Boolean).map((side) => (
              <option key={side} value={side}>
                צד {side}
              </option>
            ))}
          </select>
          <select
            value={filters.group}
            onChange={(event) => onFiltersChange({ ...filters, group: event.target.value })}
            aria-label="סינון לפי קבוצה"
          >
            <option value="">כל הקבוצות</option>
            {GUEST_GROUPS.filter(Boolean).map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
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
                {guest.attendeesCount} מקומות ·{" "}
                {guest.isSeated ? `שולחן ${guest.tableLabel || "?"}` : "ממתין לשיבוץ"}
              </span>
              {!compact ? (
                <div className="il-seat-guest-item__meta">
                  <select
                    value={guest.guestSide}
                    onChange={(event) => onGuestMetaChange(guest._id, { guestSide: event.target.value })}
                    aria-label="צד"
                  >
                    {GUEST_SIDES.map((side) => (
                      <option key={side || "none"} value={side}>
                        {side || "צד —"}
                      </option>
                    ))}
                  </select>
                  <select
                    value={guest.guestGroup}
                    onChange={(event) => onGuestMetaChange(guest._id, { guestGroup: event.target.value })}
                    aria-label="קבוצה"
                  >
                    {GUEST_GROUPS.map((group) => (
                      <option key={group || "none"} value={group}>
                        {group || "קבוצה —"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
