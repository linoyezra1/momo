import { useEffect, useState } from "react";
import { CATEGORY_OTHER_VALUE, getGuestCategory } from "../utils/guestCategories.js";

/**
 * Category select with "אחר..." to add a custom value for this event.
 */
export default function GuestCategoryField({
  id,
  label = "קטגוריה",
  value = "",
  options = [],
  onChange,
  className = "",
  selectClassName = "us-field-input",
  inputClassName = "us-field-input"
}) {
  const current = getGuestCategory(value);
  const known = options.map((item) => String(item || "").trim()).filter(Boolean);
  const isKnown = !current || known.some((item) => item === current);
  const [mode, setMode] = useState(isKnown ? "select" : "other");
  const [customValue, setCustomValue] = useState(isKnown ? "" : current);
  const [selectValue, setSelectValue] = useState(isKnown ? current : CATEGORY_OTHER_VALUE);

  useEffect(() => {
    const next = getGuestCategory(value);
    const nextKnown = !next || known.includes(next);
    if (nextKnown) {
      setMode("select");
      setSelectValue(next);
      setCustomValue("");
    } else {
      setMode("other");
      setSelectValue(CATEGORY_OTHER_VALUE);
      setCustomValue(next);
    }
    // intentionally sync from external value only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next) => {
    onChange?.(String(next || "").trim());
  };

  return (
    <div className={`il-guest-category-field ${className}`.trim()}>
      {label ? (
        <label className="us-field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className={selectClassName}
        value={mode === "other" ? CATEGORY_OTHER_VALUE : selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === CATEGORY_OTHER_VALUE) {
            setMode("other");
            setSelectValue(CATEGORY_OTHER_VALUE);
            setCustomValue("");
            emit("");
            return;
          }
          setMode("select");
          setSelectValue(next);
          setCustomValue("");
          emit(next);
        }}
        aria-label={label || "קטגוריה"}
      >
        <option value="">ללא קטגוריה</option>
        {known.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
        <option value={CATEGORY_OTHER_VALUE}>אחר...</option>
      </select>
      {mode === "other" ? (
        <input
          className={inputClassName}
          type="text"
          value={customValue}
          placeholder="שם קטגוריה חדשה"
          aria-label="שם קטגוריה חדשה"
          onChange={(event) => {
            const next = event.target.value;
            setCustomValue(next);
            emit(next);
          }}
        />
      ) : null}
    </div>
  );
}
