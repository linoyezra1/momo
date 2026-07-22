import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import "../il/il-portal.css";

const PAGE_SIZE = 50;

function formatAuditDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: "—", timeLabel: "" };
  }

  return {
    dateLabel: date.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    timeLabel: date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
  };
}

function performerBadgeClass(entry) {
  if (entry.actor === "agent") return "il-audit-log__badge--agent";
  if (entry.actor === "guest") return "il-audit-log__badge--guest";
  if (entry.actor === "client") return "il-audit-log__badge--client";
  return "il-audit-log__badge--system";
}

export default function GuestAuditLogTable({
  userId,
  apiPrefix = "client",
  title = "לוג עדכונים ושינויים",
  enableLiveUpdates = false
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const skipRef = useRef(0);

  const loadEntries = useCallback(
    async ({ append = false } = {}) => {
      if (!userId) return;
      const skip = append ? skipRef.current : 0;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const { data } = await api.get(`/${apiPrefix}/${userId}/audit-logs`, {
          params: { limit: PAGE_SIZE, skip }
        });
        const nextEntries = Array.isArray(data?.entries) ? data.entries : [];
        skipRef.current = skip + nextEntries.length;
        setHasMore(Boolean(data?.hasMore));
        setEntries((prev) => (append ? [...prev, ...nextEntries] : nextEntries));
      } catch (loadError) {
        setError(loadError.response?.data?.message || "טעינת לוג העדכונים נכשלה");
        if (!append) setEntries([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiPrefix, userId]
  );

  useEffect(() => {
    skipRef.current = 0;
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!enableLiveUpdates || !userId || apiPrefix !== "client") return undefined;

    const stream = new EventSource(`/api/client/${userId}/live-updates`);
    let refreshTimer;

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "guest-audit-log-updated") return;
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          loadEntries();
        }, 150);
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    return () => {
      window.clearTimeout(refreshTimer);
      stream.close();
    };
  }, [apiPrefix, enableLiveUpdates, loadEntries, userId]);

  return (
    <section className="il-audit-log" aria-label={title}>
      <div className="il-audit-log__header">
        <h2>{title}</h2>
        <p>מעקב בזמן אמת אחר שינויי סטטוס, כמות מגיעים ושיחות טלפון לכל מוזמן.</p>
      </div>

      {error ? <p className="il-audit-log__error">{error}</p> : null}

      <div className="il-audit-log__table-wrap">
        <table className="il-audit-log__table">
          <thead>
            <tr>
              <th scope="col">תאריך ושעה</th>
              <th scope="col">שם המוזמן</th>
              <th scope="col">העדכון</th>
              <th scope="col">בוצע על ידי</th>
            </tr>
          </thead>
          <tbody>
            {loading && !entries.length ? (
              <tr>
                <td colSpan={4} className="il-audit-log__empty">
                  טוען עדכונים…
                </td>
              </tr>
            ) : null}

            {!loading && !entries.length ? (
              <tr>
                <td colSpan={4} className="il-audit-log__empty">
                  אין עדכונים עדיין
                </td>
              </tr>
            ) : null}

            {entries.map((entry) => {
              const { dateLabel, timeLabel } = formatAuditDateTime(entry.createdAt);
              return (
                <tr key={entry._id}>
                  <td className="il-audit-log__datetime">
                    <span className="il-audit-log__date">{dateLabel}</span>
                    <span className="il-audit-log__time">{timeLabel}</span>
                  </td>
                  <td className="il-audit-log__guest">
                    <strong>{entry.guestName || "—"}</strong>
                    <span>{entry.guestPhone || "—"}</span>
                  </td>
                  <td className="il-audit-log__description">{entry.description}</td>
                  <td className="il-audit-log__performer">
                    <span className={`il-audit-log__badge ${performerBadgeClass(entry)}`}>
                      {entry.performerLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <div className="il-audit-log__footer">
          <button
            type="button"
            className="us-btn"
            onClick={() => loadEntries({ append: true })}
            disabled={loadingMore}
          >
            {loadingMore ? "טוען…" : "טען עוד"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
