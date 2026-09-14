import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import api from "../api";

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

export default function AdminWhatsAppFailures({ userId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!userId) {
      setLogs([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setQuery("");
    api
      .get(`/admin/clients/${userId}/whatsapp-delivery-failures`)
      .then((response) => {
        if (!cancelled) setLogs(response.data?.logs || []);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setLogs([]);
          setError(loadError.response?.data?.message || "טעינת דוח כשלים נכשלה");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const name = String(log.guestName || "").toLowerCase();
      const phone = String(log.guestPhone || "");
      return name.includes(q) || phone.includes(query.trim());
    });
  }, [logs, query]);

  const exportFailures = () => {
    if (!filtered.length) return;
    import("xlsx").then((XLSX) => {
      const rows = filtered.map((log) => ({
        "שם המוזמן": log.guestName || "",
        "מספר טלפון": log.guestPhone || "",
        "קוד שגיאה": log.errorCode || "",
        "סיבת הדחייה": log.errorMessageHe || log.errorMessage || "",
        "סטטוס": log.status === "undelivered" ? "לא נמסר" : "נכשל",
        "תאריך ושעת שליחה": formatStamp(log.sentAt || log.failedAt)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "כשלים");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `whatsapp-failures-${stamp}.xlsx`);
    });
  };

  return (
    <section className="us-admin-share-block us-admin-wa-failures" aria-label="דוח כשלים והודעות שלא נמסרו">
      <div className="us-admin-wa-failures__head">
        <div>
          <p className="us-admin-share-title">דוח כשלים והודעות שלא נמסרו</p>
          <p className="us-admin-field-hint">הודעות וואטסאפ שסטטוסן failed או undelivered בלבד.</p>
        </div>
        <button
          className="us-admin-btn"
          type="button"
          onClick={exportFailures}
          disabled={!filtered.length}
        >
          <Download size={14} aria-hidden="true" />
          ייצוא לאקסל
        </button>
      </div>

      <label className="us-admin-wa-failures__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש לפי שם או מספר טלפון..."
          aria-label="חיפוש כשלים לפי שם או טלפון"
        />
      </label>

      {loading ? <p className="us-admin-empty">טוען דוח…</p> : null}
      {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}
      {!loading && !error && !filtered.length ? (
        <p className="us-admin-empty">אין הודעות שנכשלו או שלא נמסרו</p>
      ) : null}

      {filtered.length ? (
        <div className="us-admin-wa-failures__table-wrap">
          <table className="us-admin-wa-failures__table">
            <thead>
              <tr>
                <th>שם המוזמן</th>
                <th>מספר טלפון</th>
                <th>קוד שגיאה</th>
                <th>סיבת הדחייה</th>
                <th>תאריך ושעת שליחה</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td>{log.guestName || "—"}</td>
                  <td dir="ltr">{log.guestPhone || "—"}</td>
                  <td>{log.errorCode || "—"}</td>
                  <td>{log.errorMessageHe || "שגיאת מסירה"}</td>
                  <td>{formatStamp(log.sentAt || log.failedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
