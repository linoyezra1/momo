import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { formatIls } from "../utils/vendors.js";
import { moneyFromStored, moneyToNumber, normalizeMoneyInput } from "../utils/moneyInput.js";
import { useEventWorkspace } from "../utils/useEventWorkspace.js";
import "../il/manager-event.css";

const PAYMENT_LABELS = {
  PENDING: "ממתין לתשלום",
  PARTIAL: "שולם חלקית",
  PAID: "שולם במלואו"
};

const emptyFinance = {
  targetCoupleBudget: "",
  couplePaymentStatus: "PENDING",
  couplePaymentNotes: ""
};

export default function ManagerBudgetPage() {
  const { userId, isManagerEvent } = useEventWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [finance, setFinance] = useState(emptyFinance);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0
  });
  const [budgetWarning, setBudgetWarning] = useState({ exceeded: false, message: "" });
  const [eventLabel, setEventLabel] = useState("");

  const loadFinance = useCallback(async () => {
    if (!isManagerEvent) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/manager/clients/${userId}/finance`);
      const loaded = data.finance || {};
      setFinance({
        targetCoupleBudget: moneyFromStored(loaded.targetCoupleBudget),
        couplePaymentStatus: loaded.couplePaymentStatus || "PENDING",
        couplePaymentNotes: loaded.couplePaymentNotes || ""
      });
      setSummary(data.summary || { totalRevenue: 0, totalCost: 0, totalProfit: 0 });
      setBudgetWarning(data.budgetWarning || { exceeded: false, message: "" });
      setEventLabel(data.eventLabel || "");
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת התקציב נכשלה");
    } finally {
      setLoading(false);
    }
  }, [isManagerEvent, userId]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    if (!successToast) return undefined;
    const timer = window.setTimeout(() => setSuccessToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  const onSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessToast("");
    try {
      const payload = {
        targetCoupleBudget: moneyToNumber(finance.targetCoupleBudget),
        couplePaymentStatus: finance.couplePaymentStatus,
        couplePaymentNotes: finance.couplePaymentNotes
      };
      const { data } = await api.patch(`/manager/clients/${userId}/finance`, payload);
      const saved = data.finance || payload;
      setFinance({
        targetCoupleBudget: moneyFromStored(saved.targetCoupleBudget),
        couplePaymentStatus: saved.couplePaymentStatus || "PENDING",
        couplePaymentNotes: saved.couplePaymentNotes || ""
      });
      setSummary(data.summary || summary);
      setBudgetWarning(data.budgetWarning || { exceeded: false, message: "" });
      setSuccessToast("תקציב היעד נשמר בהצלחה");
    } catch (saveError) {
      setError(saveError.response?.data?.message || "שמירת התקציב נכשלה");
    } finally {
      setSaving(false);
    }
  };

  if (!isManagerEvent) {
    return <p className="us-error-message">תקציב ורווחיות זמינים למנהל האירוע בלבד.</p>;
  }

  const targetBudgetValue = moneyToNumber(finance.targetCoupleBudget);

  return (
    <div className="il-budget-page" dir="rtl" lang="he">
      <header>
        <h2 style={{ margin: "0 0 0.35rem" }}>תקציב ורווחיות</h2>
        <p style={{ margin: 0, color: "#6b7280" }}>
          {eventLabel ? `סיכום כספי עבור ${eventLabel}` : "הגדרת תקציב יעד לזוג ומעקב רווחיות"}
        </p>
      </header>

      {successToast ? (
        <p className="il-budget-toast" role="status" aria-live="polite">
          {successToast}
        </p>
      ) : null}

      {budgetWarning.exceeded ? (
        <p className="il-budget-warning" role="status">
          {budgetWarning.message}
          {budgetWarning.overBy ? ` · ${formatIls(budgetWarning.overBy)} מעל היעד` : ""}
        </p>
      ) : null}

      <section className="il-budget-summary" aria-label="סיכום כספי">
        <div className="il-budget-card il-budget-card--target">
          <span>תקציב יעד</span>
          <strong>{formatIls(targetBudgetValue)}</strong>
        </div>
        <div className="il-budget-card">
          <span>סה״כ הכנסות (מחיר לזוג)</span>
          <strong>{formatIls(summary.totalRevenue)}</strong>
        </div>
        <div className="il-budget-card">
          <span>סה״כ עלות ספקים</span>
          <strong>{formatIls(summary.totalCost)}</strong>
        </div>
        <div className="il-budget-card il-budget-card--profit">
          <span>סה״כ רווח</span>
          <strong>{formatIls(summary.totalProfit)}</strong>
        </div>
        <div className="il-budget-card">
          <span>סטטוס תשלום הזוג</span>
          <strong>{PAYMENT_LABELS[finance.couplePaymentStatus] || finance.couplePaymentStatus}</strong>
        </div>
      </section>

      {error ? <p className="us-error-message">{error}</p> : null}
      {loading ? <p>טוען תקציב…</p> : null}

      <form className="il-budget-form" onSubmit={onSave}>
        <label>
          תקציב הזוג (יעד)
          <input
            className="il-money-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={finance.targetCoupleBudget}
            onChange={(e) =>
              setFinance((prev) => ({
                ...prev,
                targetCoupleBudget: normalizeMoneyInput(e.target.value)
              }))
            }
          />
        </label>
        <label>
          סטטוס תשלום הזוג
          <select
            value={finance.couplePaymentStatus}
            onChange={(e) =>
              setFinance((prev) => ({ ...prev, couplePaymentStatus: e.target.value }))
            }
          >
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          הערות תשלום
          <textarea
            rows={3}
            value={finance.couplePaymentNotes}
            onChange={(e) =>
              setFinance((prev) => ({ ...prev, couplePaymentNotes: e.target.value }))
            }
          />
        </label>
        <div className="il-budget-form__actions">
          <button className="us-btn us-btn--primary" type="submit" disabled={saving}>
            {saving ? "שומר…" : "שמירת תקציב"}
          </button>
        </div>
      </form>
    </div>
  );
}
