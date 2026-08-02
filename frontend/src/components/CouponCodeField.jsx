import { useEffect, useId, useState } from "react";
import api from "../api";
import "./CouponCodeField.css";

function usableCoupons(list = []) {
  return (Array.isArray(list) ? list : []).filter(
    (item) => Number(item?.remaining_credits) > 0 && String(item?.code || "").trim()
  );
}

/**
 * Coupon input with active-code suggestion chips for an event/client.
 */
export default function CouponCodeField({
  userId = "",
  value = "",
  onChange,
  label = "קוד קופון",
  hint = "",
  placeholder = "הזינו קוד קופון",
  id,
  required = false,
  disabled = false,
  coupons: couponsProp,
  className = "",
  autoSelectFirst = true
}) {
  const reactId = useId();
  const inputId = id || `coupon-code-${reactId}`;
  const [loadedCoupons, setLoadedCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const coupons = couponsProp != null ? usableCoupons(couponsProp) : usableCoupons(loadedCoupons);

  useEffect(() => {
    if (couponsProp != null || !userId) return undefined;
    let cancelled = false;

    async function loadCoupons() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await api.get(`/client/${userId}/whatsapp/quota`);
        if (cancelled) return;
        const list = Array.isArray(response.data?.quotas) ? response.data.quotas : [];
        const usable = usableCoupons(list);
        setLoadedCoupons(usable);
        if (autoSelectFirst && !String(value || "").trim() && usable[0]?.code) {
          onChange?.(String(usable[0].code).toUpperCase());
        }
      } catch {
        if (!cancelled) {
          setLoadedCoupons([]);
          setLoadError("לא ניתן לטעון קופונים שמורים");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCoupons();
    return () => {
      cancelled = true;
    };
    // Intentionally omit value/onChange to avoid re-fetch loops while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, couponsProp, autoSelectFirst]);

  useEffect(() => {
    if (!autoSelectFirst || couponsProp == null) return;
    if (String(value || "").trim()) return;
    const first = usableCoupons(couponsProp)[0];
    if (first?.code) onChange?.(String(first.code).toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectFirst, couponsProp]);

  function handleInputChange(event) {
    onChange?.(event.target.value.toUpperCase());
  }

  function selectCoupon(code) {
    onChange?.(String(code || "").trim().toUpperCase());
  }

  return (
    <div className={`il-coupon-field ${className}`.trim()} dir="rtl">
      <div className="il-coupon-field__copy">
        {label ? (
          <label className="il-coupon-field__label" htmlFor={inputId}>
            {label}
            {required ? <span className="il-coupon-field__required">*</span> : null}
          </label>
        ) : null}
        {hint ? <p className="il-coupon-field__hint">{hint}</p> : null}
      </div>

      <div className="il-coupon-field__suggestions" aria-label="קופונים פעילים">
        {loading ? <p className="il-coupon-field__empty">טוען קופונים…</p> : null}
        {!loading && coupons.length ? (
          <div className="il-coupon-field__chips">
            {coupons.map((item) => {
              const code = String(item.code).toUpperCase();
              const selected = String(value || "").trim().toUpperCase() === code;
              return (
                <button
                  key={code}
                  type="button"
                  className={`il-coupon-field__chip${selected ? " is-selected" : ""}`}
                  onClick={() => selectCoupon(code)}
                  disabled={disabled}
                >
                  <strong>{code}</strong>
                  <span>
                    {item.remaining_credits}/{item.total_credits}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {!loading && !coupons.length ? (
          <p className="il-coupon-field__empty">
            {loadError || "אין קופונים שמורים לאירוע זה"}
          </p>
        ) : null}
      </div>

      {coupons.length > 1 ? (
        <select
          className="il-coupon-field__select"
          value={String(value || "").trim().toUpperCase()}
          onChange={(event) => selectCoupon(event.target.value)}
          disabled={disabled}
          aria-label="בחירת קופון מרשימה"
        >
          <option value="">בחרו קופון מהרשימה</option>
          {coupons.map((item) => {
            const code = String(item.code).toUpperCase();
            return (
              <option key={`opt-${code}`} value={code}>
                {code} · נותרו {item.remaining_credits}/{item.total_credits}
              </option>
            );
          })}
        </select>
      ) : null}

      <input
        id={inputId}
        className="il-coupon-field__input"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        required={required}
        disabled={disabled}
        inputMode="text"
      />
    </div>
  );
}
