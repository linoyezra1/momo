import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import api from "../api";
import { formatIsraeliDate } from "../utils/dateFormat";

function formatStamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(4)}`;
}

export default function AdminGlobalFailuresReport({ clients = [] }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [syncNote, setSyncNote] = useState("");

  const loadFailures = (mode = "auto") => {
    setLoading(true);
    setError("");
    const params = {};
    if (clientFilter) params.userId = clientFilter;
    if (mode === "force") params.sync = "force";
    api
      .get("/admin/reports/whatsapp-failures", { params })
      .then((response) => {
        setLogs(Array.isArray(response.data?.logs) ? response.data.logs : []);
        const sync = response.data?.sync || {};
        if (sync.error) setSyncNote(sync.error);
        else if (sync.imported > 0) setSyncNote(`עודכנו ${sync.imported} כשלים מ־Twilio`);
        else setSyncNote("");
      })
      .catch((loadError) => {
        setLogs([]);
        setError(loadError.response?.data?.message || "טעינת דוח כשלים נכשלה");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFailures("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when client filter changes
  }, [clientFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const hay = [
        log.guestName,
        log.guestPhone,
        log.clientLabel,
        log.clientEventDate,
        log.errorCode,
        log.errorMessageHe,
        log.errorMessage
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [logs, query]);

  const exportFailures = () => {
    if (!filtered.length) return;
    import("xlsx").then((XLSX) => {
      const rows = filtered.map((log) => ({
        לקוח: log.clientLabel || "",
        "תאריך אירוע": log.clientEventDate || "",
        "שם המוזמן": log.guestName || "",
        "מספר טלפון": log.guestPhone || "",
        "קוד שגיאה": log.errorCode || "",
        "סיבת הדחייה": log.errorMessageHe || log.errorMessage || "",
        סטטוס: log.status === "undelivered" ? "לא נמסר" : "נכשל",
        "עלות ($)": log.actualCost ?? log.costUsd ?? 0,
        "תאריך ושעת שליחה": formatStamp(log.sentAt || log.failedAt)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "כשלים");
      XLSX.writeFile(workbook, `whatsapp-failures-all-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  };

  const clientOptions = useMemo(() => {
    return (clients || []).map((client) => {
      const label =
        [client.event?.groomName, client.event?.brideName].filter(Boolean).join(" ו") ||
        client.event?.eventNames ||
        client.username ||
        "לקוח";
      const date = client.event?.eventDate ? formatIsraeliDate(client.event.eventDate) : "";
      return {
        id: String(client.userId),
        label: date ? `${label} · ${date}` : label
      };
    });
  }, [clients]);

  return (
    <section className="us-admin-card" aria-label="דוח כשלים גלובלי">
      <h2 className="us-admin-card-title">דוחות כשלים</h2>
      <div className="us-admin-card-body">
        <p className="us-admin-field-hint" style={{ marginTop: 0 }}>
          כל כשלי הוואטסאפ במערכת בטבלה אחת, כולל עלות וזיהוי לקוח (זוג + תאריך אירוע).
        </p>

        <div className="us-admin-wa-failures__head" style={{ marginBottom: "1rem" }}>
          <div className="us-admin-toolbar" style={{ marginBottom: 0, flex: 1 }}>
            <label className="us-admin-field" style={{ minWidth: "14rem" }}>
              סינון לפי לקוח
              <select
                className="us-admin-field-input"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="">כל הלקוחות</option>
                {clientOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="us-admin-wa-failures__search" style={{ flex: 1, minWidth: "12rem" }}>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="חיפוש מוזמן, טלפון, לקוח, קוד שגיאה…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="us-admin-wa-failures__actions">
            <button className="us-admin-btn" type="button" onClick={() => loadFailures("force")} disabled={loading}>
              <RefreshCw size={14} />
              {loading ? "טוען…" : "רענון"}
            </button>
            <button
              className="us-admin-btn"
              type="button"
              onClick={exportFailures}
              disabled={!filtered.length}
            >
              <Download size={14} />
              ייצוא
            </button>
          </div>
        </div>

        {syncNote ? <p className="us-admin-message">{syncNote}</p> : null}
        {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}
        {loading && !logs.length ? <p className="us-admin-empty">טוען כשלים…</p> : null}
        {!loading && !filtered.length ? <p className="us-admin-empty">אין כשלים להצגה</p> : null}

        {filtered.length ? (
          <div className="us-admin-wa-failures__table-wrap">
            <table className="us-admin-wa-failures__table">
              <thead>
                <tr>
                  <th>לקוח</th>
                  <th>מוזמן</th>
                  <th>טלפון</th>
                  <th>סטטוס</th>
                  <th>קוד</th>
                  <th>סיבה</th>
                  <th>עלות ($)</th>
                  <th>זמן</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id || log.messageSid}>
                    <td>
                      <strong>{log.clientLabel || "—"}</strong>
                      <span className="us-admin-table-sub">
                        {log.clientEventDate
                          ? formatIsraeliDate(log.clientEventDate)
                          : "ללא תאריך"}
                      </span>
                    </td>
                    <td>{log.guestName || "—"}</td>
                    <td dir="ltr">{log.guestPhone || "—"}</td>
                    <td>{log.status === "undelivered" ? "לא נמסר" : "נכשל"}</td>
                    <td dir="ltr">{log.errorCode || "—"}</td>
                    <td>{log.errorMessageHe || log.errorMessage || "—"}</td>
                    <td dir="ltr">{formatUsd(log.actualCost ?? log.costUsd)}</td>
                    <td>{formatStamp(log.sentAt || log.failedAt || log.createdAt)}</td>
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
