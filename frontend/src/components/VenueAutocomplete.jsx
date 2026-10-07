import { useEffect, useRef, useState } from "react";
import api from "../api";

/**
 * Hall name input with catalog suggestions; selecting a match autofills city + street.
 */
export default function VenueAutocomplete({
  id,
  name = "venueName",
  value = "",
  onChange,
  onVenueSelect,
  className = "",
  searchPath = "/admin/venues",
  placeholder = "",
  disabled = false,
  autoComplete = "off"
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return undefined;
    }
    const q = String(value || "").trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    debounceRef.current = window.setTimeout(() => {
      setLoading(true);
      api
        .get(searchPath, { params: { q, limit: 12 } })
        .then((response) => {
          const rows = Array.isArray(response.data?.venues) ? response.data.venues : [];
          setSuggestions(rows);
          setOpen(rows.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, searchPath]);

  const pickVenue = (venue) => {
    skipSearchRef.current = true;
    setOpen(false);
    setSuggestions([]);
    if (typeof onVenueSelect === "function") {
      onVenueSelect(venue);
      return;
    }
    if (typeof onChange === "function") {
      onChange({
        target: { name, value: venue?.name || "", type: "text" }
      });
    }
  };

  return (
    <div className="venue-autocomplete" ref={wrapRef}>
      <input
        id={id}
        className={className}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={onChange}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
      />
      {open && suggestions.length ? (
        <ul className="venue-autocomplete__list" role="listbox">
          {suggestions.map((venue) => (
            <li key={venue.id || venue.name}>
              <button
                type="button"
                className="venue-autocomplete__option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickVenue(venue)}
              >
                <strong>{venue.name}</strong>
                {venue.city || venue.streetAndNumber ? (
                  <span>
                    {[venue.streetAndNumber, venue.city].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {loading ? <span className="venue-autocomplete__hint">מחפש אולמות…</span> : null}
    </div>
  );
}
