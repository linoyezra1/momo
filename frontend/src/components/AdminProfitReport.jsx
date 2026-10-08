import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import api from "../api";

function formatIls(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function BarChart({ rows, valueKey, labelKey, color = "#c46b6b" }) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  if (!rows.length) {
    return <p className="us-admin-empty">אין נתונים לגרף</p>;
  }
  return (
    <div className="us-admin-profit-bars" role="img" aria-label="גרף מקורות שיווק">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        const pct = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={row[labelKey]} className="us-admin-profit-bars__row">
            <div className="us-admin-profit-bars__label">{row[labelKey] || "לא צוין"}</div>
            <div className="us-admin-profit-bars__track">
              <div
                className="us-admin-profit-bars__fill"
                style={{ width: `${pct}%`, background: color }}
                title={String(value)}
              />
            </div>
            <div className="us-admin-profit-bars__value">{value}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminProfitReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    api
      .get("/admin/reports/profit")
      .then((response) => setData(response.data || null))
      .catch((loadError) => {
        setData(null);
        setError(loadError.response?.data?.message || "טעינת דוח רווח נכשלה");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary || {};
  const bySource = useMemo(() => {
    const rows = Array.isArray(data?.byMarketingSource) ? data.byMarketingSource : [];
    return [...rows].sort((a, b) => (Number(b.clientCount) || 0) - (Number(a.clientCount) || 0));
  }, [data]);

  const bySourceRevenue = useMemo(() => {
    return [...bySource].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0));
  }, [bySource]);

  const byMonth = useMemo(() => {
    const rows = Array.isArray(data?.byMonth) ? data.byMonth : [];
    return [...rows].sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));
  }, [data]);

  return (
    <section className="us-admin-card" aria-label="דוחות רווח">
      <div className="us-admin-toolbar" style={{ marginBottom: 0 }}>
        <h2 className="us-admin-card-title" style={{ margin: 0, border: 0, background: "transparent", flex: 1 }}>
          דוחות רווח
        </h2>
        <button className="us-admin-btn" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={14} />
          {loading ? "טוען…" : "רענון"}
        </button>
      </div>
      <div className="us-admin-card-body">
        <p className="us-admin-field-hint" style={{ marginTop: 0 }}>
          לוח מכוונים: הכנסות לפי חודשי תשלום, עלויות Twilio/Meta, ומקורות שיווק.
        </p>
        {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}

        <div className="us-admin-stats" style={{ marginBottom: "1.25rem" }}>
          <div className="us-admin-stat-card">
            <h3>הכנסות</h3>
            <p>{formatIls(summary.revenueIls)}</p>
          </div>
          <div className="us-admin-stat-card">
            <h3>Twilio (₪)</h3>
            <p>{formatIls(summary.twilioCostIls)}</p>
            <span className="us-admin-stat-note">{formatUsd(summary.twilioCostUsd)}</span>
          </div>
          <div className="us-admin-stat-card">
            <h3>רווח משוער</h3>
            <p>{formatIls(summary.profitIls)}</p>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h3 className="us-admin-share-title">הכנסות לפי חודש</h3>
          <p className="us-admin-field-hint">
            לפי תאריך התשלום בפועל (תשלומים שסומנו כשולמו). ללקוחות ישנים בלי פירוט — לפי תאריך יצירה.
          </p>
          <BarChart rows={byMonth} valueKey="revenue" labelKey="label" color="#4a2e2b" />
          {byMonth.length ? (
            <div className="us-admin-table-wrap" style={{ marginTop: "0.85rem" }}>
              <table className="us-admin-clients-table">
                <thead>
                  <tr>
                    <th>חודש</th>
                    <th>מספר תשלומים</th>
                    <th>הכנסות</th>
                  </tr>
                </thead>
                <tbody>
                  {byMonth.map((row) => (
                    <tr key={row.monthKey}>
                      <td>{row.label || row.monthKey}</td>
                      <td>{row.paymentCount || 0}</td>
                      <td>{formatIls(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="us-admin-profit-grid">
          <div>
            <h3 className="us-admin-share-title">לקוחות לפי מקור שיווק</h3>
            <BarChart rows={bySource} valueKey="clientCount" labelKey="source" color="#4a2e2b" />
          </div>
          <div>
            <h3 className="us-admin-share-title">הכנסות לפי מקור (₪)</h3>
            <BarChart rows={bySourceRevenue} valueKey="revenue" labelKey="source" color="#c46b6b" />
          </div>
        </div>

        {bySource.length ? (
          <div className="us-admin-table-wrap" style={{ marginTop: "1.25rem" }}>
            <table className="us-admin-clients-table">
              <thead>
                <tr>
                  <th>מקור</th>
                  <th>לקוחות</th>
                  <th>הכנסות</th>
                  <th>Twilio (₪)</th>
                  <th>רווח</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((row) => (
                  <tr key={row.source || "none"}>
                    <td>{row.source || "לא צוין"}</td>
                    <td>{row.clientCount}</td>
                    <td>{formatIls(row.revenue)}</td>
                    <td>{formatIls(row.twilioCostIls)}</td>
                    <td>{formatIls(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
