import { countGuestSeats, filterSeatingGuests } from "./ilSeatingUtils.js";

export default function IlSeatingGuestPanel({
  guests,
  filters,
  onFiltersChange,
  onDragStart,
  onGuestPointerDown,
  compact = false
}) {
  const filtered = filterSeatingGuests(guests, { ...filters, seated: "floating" });

  return (
    <aside className={`il-seat-guest-panel${compact ? " is-compact" : ""}`} dir="rtl">
      <h3>אורחים להושבה</h3>
      {!compact ? (
        <p className="il-seat-guest-panel__hint">מסונכרן אוטומטית מ-RSVP (מגיע / אולי) · משובצים מופיעים בשולחנות בלבד</p>
      ) : null}

      <div className="il-seat-search-row">
        <input
          type="search"
          placeholder="חיפוש לפי שם או טלפון"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
          aria-label="חיפוש אורחים"
        />
      </div>

      <p className="il-seat-guest-panel__count" aria-live="polite">
        {filtered.length} ממתינים לשיבוץ
      </p>

      <ul className="il-seat-guest-list">
        {!filtered.length ? (
          <li className="il-seat-guest-item is-empty">
            <div className="il-seat-guest-item__main">
              <span>אין אורחים ממתינים לשיבוץ</span>
            </div>
          </li>
        ) : null}
        {filtered.map((guest) => (
          <li
            key={guest._id}
            className="il-seat-guest-item is-floating"
            draggable
            onDragStart={(event) => onDragStart(event, guest._id)}
            onPointerDown={(event) => onGuestPointerDown?.(event, guest._id)}
          >
            <div className="il-seat-guest-item__main">
              <strong>{guest.fullName}</strong>
              <span>{countGuestSeats(guest)} מושבים · ממתין לשיבוץ</span>
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
