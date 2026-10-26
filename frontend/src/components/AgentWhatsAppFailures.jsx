import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import api from "../api";
import SmsIcon from "./SmsIcon.jsx";
import WhatsAppIcon from "./WhatsAppIcon.jsx";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize.js";
import { buildDirectGuestWhatsAppMessage, toInternationalWhatsAppPhone } from "../utils/whatsapp.js";

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

function statusLabel(status) {
  return status === "undelivered" ? "לא נמסר" : "נכשל";
}

function buildInviteMessage({ guestName, event, userId }) {
  if (!event || !userId) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return buildDirectGuestWhatsAppMessage({
    event,
    eventId: userId,
    origin,
    guestName
  });
}

function buildWhatsAppUrl({ guestName, guestPhone, event, userId }) {
  const phone = toInternationalWhatsAppPhone(guestPhone);
  const message = buildInviteMessage({ guestName, event, userId });
  if (!phone || !message) return "";
  const encoded = encodeURIComponent(message);
  if (typeof window !== "undefined") {
    const ua = String(window.navigator?.userAgent || "").toLowerCase();
    if (/android|iphone|ipad|ipod/.test(ua)) {
      return `whatsapp://send?phone=${phone}&text=${encoded}`;
    }
  }
  return `https://wa.me/${phone}?text=${encoded}`;
}

function buildSmsUrl({ guestName, guestPhone, event, userId }) {
  const domestic = normalizeIsraeliPhone(guestPhone);
  const message = buildInviteMessage({ guestName, event, userId });
  if (!domestic || !message) return "";
  const intlPhone = `+972${domestic.slice(1)}`;
  return `sms:${intlPhone}?body=${encodeURIComponent(message)}`;
}

export default function AgentWhatsAppFailures({ userId, event }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [syncNote, setSyncNote] = useState("");

  const loadFailures = (mode = "auto") => {
    if (!userId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    setError("");
    if (mode === "auto") setQuery("");
    const params = mode === "force" ? { sync: "force" } : undefined;
    api
      .get(`/agent/${userId}/whatsapp-delivery-failures`, { params })
      .then((response) => {
        setLogs(response.data?.logs || []);
        const sync = response.data?.sync || {};
        if (sync.error) {
          setSyncNote(sync.error);
        } else if (sync.imported > 0) {
          setSyncNote(`עודכנו ${sync.imported} כשלים מהיסטוריית Twilio`);
        } else if (sync.reason === "twilio_not_configured") {
          setSyncNote("לא ניתן למשוך היסטוריה — Twilio לא מוגדר בשרת");
        } else {
          setSyncNote("");
        }
      })
      .catch((loadError) => {
        setLogs([]);
        setError(loadError.response?.data?.message || "טעינת דוח כשלים נכשלה");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFailures("auto");
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const name = String(log.guestName || "").toLowerCase();
      const phone = String(log.guestPhone || "");
      const reason = String(log.errorMessageHe || log.errorMessage || "").toLowerCase();
      return name.includes(q) || phone.includes(query.trim()) || reason.includes(q);
    });
  }, [logs, query]);

  return (
    <section className="agent-wa-failures" aria-label="הודעות שלא נשלחו">
      <div className="agent-wa-failures__head">
        <div>
          <h2>הודעות שלא נשלחו</h2>
          <p>
            כשלי Twilio (failed / undelivered) — שליחה ידנית בוואטסאפ או ב-SMS עם מלל ההזמנה.
          </p>
        </div>
        <button
          className="agent-btn"
          type="button"
          onClick={() => loadFailures("force")}
          disabled={loading}
        >
          <RefreshCw size={14} aria-hidden="true" />
          רענון מ-Twilio
        </button>
      </div>

      <label className="agent-wa-failures__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש לפי שם, טלפון או סיבה..."
          aria-label="חיפוש כשלים"
        />
      </label>

      {loading ? <p className="agent-muted">מעדכן כשלים מ-Twilio…</p> : null}
      {syncNote ? <p className="agent-muted">{syncNote}</p> : null}
      {error ? <p className="agent-error">{error}</p> : null}
      {!loading && !error && !filtered.length ? (
        <p className="agent-muted">אין הודעות שנכשלו או שלא נמסרו</p>
      ) : null}

      {filtered.length ? (
        <div className="agent-wa-failures__table-wrap">
          <table className="agent-wa-failures__table">
            <thead>
              <tr>
                <th>שם המוזמן</th>
                <th>מספר טלפון</th>
                <th>סטטוס</th>
                <th>קוד</th>
                <th>סיבת הדחייה</th>
                <th>תאריך ושעת שליחה</th>
                <th>שליחה ידנית</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const guest = { fullName: log.guestName, phone: log.guestPhone };
                const waHref = buildWhatsAppUrl({
                  guestName: guest.fullName,
                  guestPhone: guest.phone,
                  event,
                  userId
                });
                const smsHref = buildSmsUrl({
                  guestName: guest.fullName,
                  guestPhone: guest.phone,
                  event,
                  userId
                });
                return (
                  <tr key={log.id}>
                    <td>{log.guestName || "—"}</td>
                    <td dir="ltr">{log.guestPhone || "—"}</td>
                    <td>
                      <span
                        className={`agent-wa-failures__status${
                          log.status === "undelivered" ? " is-undelivered" : " is-failed"
                        }`}
                      >
                        {statusLabel(log.status)}
                      </span>
                    </td>
                    <td>{log.errorCode || "—"}</td>
                    <td>{log.errorMessageHe || log.errorMessage || "שגיאת מסירה"}</td>
                    <td>{formatStamp(log.sentAt || log.failedAt)}</td>
                    <td className="agent-table-actions">
                      {waHref ? (
                        <a
                          className="agent-quick-action agent-quick-action--whatsapp"
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`וואטסאפ ל${log.guestName || "מוזמן"}`}
                          title="שליחת הזמנה בוואטסאפ"
                        >
                          <WhatsAppIcon size={18} />
                        </a>
                      ) : (
                        <span className="agent-quick-action is-disabled" title="אין מספר תקין">
                          <WhatsAppIcon size={18} />
                        </span>
                      )}
                      {smsHref ? (
                        <a
                          className="agent-quick-action agent-quick-action--sms"
                          href={smsHref}
                          aria-label={`SMS ל${log.guestName || "מוזמן"}`}
                          title="שליחת הזמנה ב-SMS"
                        >
                          <SmsIcon size={18} />
                        </a>
                      ) : (
                        <span className="agent-quick-action is-disabled" title="אין מספר תקין">
                          <SmsIcon size={18} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
