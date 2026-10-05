import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
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

function formatUsd(value) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })}`;
}

function formatIls(value) {
  const amount = Number(value) || 0;
  return `₪${amount.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function statusLabel(status) {
  const map = {
    queued: "בתור",
    sent: "נשלח",
    delivered: "נמסר",
    read: "נקרא",
    failed: "נכשל",
    undelivered: "לא נמסר",
    unknown: "לא ידוע"
  };
  return map[status] || status || "—";
}

function directionLabel(direction) {
  return direction === "inbound" ? "נכנסת" : "יוצאת";
}

export default function AdminWhatsAppBilling({ userId, dealSupplierCostIls = null }) {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [syncNote, setSyncNote] = useState("");

  const loadBilling = (mode = "auto") => {
    if (!userId) {
      setLogs([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    setError("");
    if (mode === "auto") setQuery("");
    const params = mode === "force" ? { sync: "force" } : undefined;
    api
      .get(`/admin/clients/${userId}/whatsapp-billing-logs`, { params })
      .then((response) => {
        setLogs(response.data?.logs || []);
        setSummary(response.data?.summary || null);
        const sync = response.data?.sync;
        if (response.data?.syncError) {
          setSyncNote(response.data.syncError);
        } else if (sync && !sync.skipped) {
          setSyncNote(
            `סנכרון: עודכנו ${sync.updated || 0} · נוצרו ${sync.created || 0} · הותאמו ${sync.matched || 0}`
          );
        } else if (sync?.reason === "twilio_not_configured") {
          setSyncNote("Twilio לא מוגדר בשרת");
        } else if (mode === "force" && sync?.skipped) {
          setSyncNote(sync.reason === "cooldown" ? "סנכרון דולג (cooldown)" : "הסנכרון דולג");
        } else {
          setSyncNote("");
        }
      })
      .catch((loadError) => {
        setLogs([]);
        setSummary(null);
        setError(loadError.response?.data?.message || "טעינת לוגי עלויות נכשלה");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBilling("auto");
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (filter === "billed" && !log.isBilled) return false;
      if (filter === "failed" && log.status !== "failed" && log.status !== "undelivered") return false;
      if (filter === "inbound" && log.direction !== "inbound") return false;
      if (filter === "outbound" && log.direction !== "outbound") return false;
      if (filter === "with_price" && !(log.isBilled && Number(log.actualCost) > 0)) return false;
      if (filter === "no_price" && !(log.isBilled && !(Number(log.actualCost) > 0))) return false;
      if (!q) return true;
      const name = String(log.guestName || "").toLowerCase();
      const phone = String(log.guestPhone || "");
      const sid = String(log.messageSid || "").toLowerCase();
      return name.includes(q) || phone.includes(query.trim()) || sid.includes(q);
    });
  }, [logs, query, filter]);

  const exportLogs = () => {
    if (!filtered.length) return;
    import("xlsx").then((XLSX) => {
      const rows = filtered.map((log) => ({
        "כיוון": directionLabel(log.direction),
        "שם": log.guestName || "",
        "טלפון": log.guestPhone || "",
        "Message SID": log.messageSid || "",
        "סטטוס": statusLabel(log.status),
        "מחויב": log.isBilled ? "כן" : "לא",
        "עלות USD": Number(log.actualCost) || 0,
        "תאריך": formatStamp(log.sentAt || log.failedAt),
        "שגיאה": log.errorCode || "",
        "סיבה": log.errorMessageHe || ""
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "עלויות");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `whatsapp-billing-${stamp}.xlsx`);
    });
  };

  const dealCost =
    dealSupplierCostIls != null && dealSupplierCostIls !== ""
      ? Number(dealSupplierCostIls)
      : summary?.dealSupplierCostIls;

  return (
    <section className="us-admin-share-block us-admin-wa-billing" aria-label="עלויות הודעות Twilio">
      <div className="us-admin-wa-failures__head">
        <div>
          <p className="us-admin-share-title">עלויות הודעות (לוג Twilio)</p>
          <p className="us-admin-field-hint">
            כל שורה = הודעה אחת (יוצאת או נכנסת) כפי שנרשמה אצלנו מ־Twilio — לא מספר מוזמנים.
          </p>
        </div>
        <div className="us-admin-wa-failures__actions">
          <button
            className="us-admin-btn"
            type="button"
            onClick={() => loadBilling("force")}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" />
            סנכרון מחירים מ־Twilio
          </button>
          <button
            className="us-admin-btn"
            type="button"
            onClick={exportLogs}
            disabled={!filtered.length}
          >
            <Download size={14} aria-hidden="true" />
            ייצוא לאקסל
          </button>
        </div>
      </div>

      <div className="us-admin-billing-explain">
        <p>
          <strong>עלות Twilio בפועל ($)</strong> — סכום שדה <code>Price</code> מכל הודעה שחויבה
          (<code>sent</code> / <code>delivered</code> / <code>read</code> / Inbound). זה{" "}
          <em>לא</em> «כמות הודעות × תעריף קבוע», אלא סכימת מחירים בודדים. המחיר מ־Twilio כבר כולל את
          עמלת Meta/WhatsApp — אין פיצול נפרד «Twilio / Meta» מה־API.
        </p>
        <p>
          <strong>עלות ספק בעסקה (₪)</strong> — חישוב פנימי נפרד: סכום מכסות הקופונים שהוקצו ללקוח ×
          ₪0.50 להודעה. לא קשור ישירות ל־Price של Twilio.
        </p>
      </div>

      {summary ? (
        <div className="us-admin-billing-summary">
          <div className="us-admin-billing-summary__card">
            <span>סה״כ לוגים</span>
            <strong>{summary.totalLogs}</strong>
          </div>
          <div className="us-admin-billing-summary__card">
            <span>הודעות שחויבו</span>
            <strong>{summary.billedCount}</strong>
            <small>
              יוצאות {summary.outboundCount} · נכנסות {summary.inboundCount}
            </small>
          </div>
          <div className="us-admin-billing-summary__card">
            <span>עם מחיר מ־Twilio</span>
            <strong>{summary.billedWithPriceCount}</strong>
            <small>בלי מחיר עדיין: {summary.billedWithoutPriceCount}</small>
          </div>
          <div className="us-admin-billing-summary__card">
            <span>נכשלו / לא נמסרו</span>
            <strong>{summary.failedCount}</strong>
            <small>עלות $0</small>
          </div>
          <div className="us-admin-billing-summary__card is-accent">
            <span>סה״כ Twilio</span>
            <strong>{formatUsd(summary.totalTwilioUsd)}</strong>
            <small>ממוצע להודעה שחויבה: {formatUsd(summary.avgTwilioUsd)}</small>
          </div>
          <div className="us-admin-billing-summary__card">
            <span>עלות ספק בעסקה</span>
            <strong>{dealCost == null ? "—" : formatIls(dealCost)}</strong>
            <small>קופונים × ₪0.50</small>
          </div>
        </div>
      ) : null}

      {syncNote ? <p className="us-admin-message">{syncNote}</p> : null}
      {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}

      <div className="us-admin-billing-filters">
        <label className="us-admin-wa-failures__search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לפי שם, טלפון או Message SID"
          />
        </label>
        <select
          className="us-admin-field-input us-admin-billing-filters__select"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="סינון לוגי עלויות"
        >
          <option value="all">הכל</option>
          <option value="billed">רק שחויבו</option>
          <option value="with_price">שחויבו + יש Price</option>
          <option value="no_price">שחויבו בלי Price</option>
          <option value="outbound">יוצאות</option>
          <option value="inbound">נכנסות</option>
          <option value="failed">כשלים</option>
        </select>
      </div>

      {loading ? <p className="us-admin-empty">טוען לוגי עלויות…</p> : null}

      {!loading && !filtered.length ? (
        <p className="us-admin-empty">אין רשומות עלות להצגה. נסו «סנכרון מחירים מ־Twilio».</p>
      ) : null}

      {filtered.length ? (
        <div className="us-admin-wa-failures__table-wrap">
          <table className="us-admin-wa-failures__table">
            <thead>
              <tr>
                <th>כיוון</th>
                <th>שם</th>
                <th>טלפון</th>
                <th>סטטוס</th>
                <th>מחויב</th>
                <th>עלות ($)</th>
                <th>Message SID</th>
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className={log.isBilled ? "" : "is-unbilled"}>
                  <td>{directionLabel(log.direction)}</td>
                  <td>{log.guestName || "—"}</td>
                  <td dir="ltr">{log.guestPhone || "—"}</td>
                  <td>
                    {statusLabel(log.status)}
                    {log.errorCode ? (
                      <div className="us-admin-stat-note">
                        {log.errorCode}
                        {log.errorMessageHe ? ` · ${log.errorMessageHe}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td>{log.isBilled ? "כן" : "לא"}</td>
                  <td dir="ltr">{formatUsd(log.actualCost)}</td>
                  <td className="us-admin-detail-value--mono" dir="ltr">
                    {log.messageSid || "—"}
                  </td>
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
