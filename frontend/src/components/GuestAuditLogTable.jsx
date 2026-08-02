import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
  if (entry.actor === "hostess") return "il-audit-log__badge--hostess";
  return "il-audit-log__badge--system";
}

function Bold({ children }) {
  return <strong className="il-audit-log__em">{children}</strong>;
}

function GuestCountPart({ status, count }) {
  if (typeof count !== "number" || status === "לא מגיע") return null;
  return (
    <>
      {" "}
      (
      <Bold>{count}</Bold> אורחים)
    </>
  );
}

function NotesPart({ notes }) {
  const text = String(notes || "").trim();
  if (!text) return null;
  return (
    <span className="il-audit-log__note">
      {" "}
      · הערה: &quot;{text}&quot;
    </span>
  );
}

function renderBoldMarkedText(text) {
  const raw = String(text || "");
  if (!raw) return "—";

  const parts = raw.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <Bold key={`${part}-${index}`}>{part.slice(2, -2)}</Bold>;
    }

    // Soft-clean leftover technical arrows in legacy rows
    const cleaned = part.replace(/\s*→\s*/g, " ל-");
    return <Fragment key={`${cleaned}-${index}`}>{cleaned}</Fragment>;
  });
}

function getStatusFromEntry(entry) {
  return entry?.changes?.status?.to || entry?.changes?.status || null;
}

function getCountFromEntry(entry) {
  const count = entry?.changes?.attendeesCount?.to;
  return typeof count === "number" ? count : null;
}

function statusBadgeClass(status) {
  if (status === "מגיע" || status === "הגיע לאירוע") return "il-audit-log__status--coming";
  if (status === "אולי") return "il-audit-log__status--maybe";
  if (status === "לא מגיע") return "il-audit-log__status--declined";
  return "il-audit-log__status--unknown";
}

function formatGuestCountLabel(status, count) {
  if (status === "לא מגיע") return "לא מגיע";
  if (typeof count !== "number") return null;
  if (count === 1) return "1 אורח";
  return `${count} אורחים`;
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const { dateLabel, timeLabel } = formatAuditDateTime(value);
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

function AuditMobileCard({ entry }) {
  const status = getStatusFromEntry(entry);
  const count = getCountFromEntry(entry);
  const countLabel = formatGuestCountLabel(status, count);
  const timeLabel = formatRelativeTime(entry.createdAt);
  const performer = entry.performerLabel || "מערכת";

  return (
    <article className="il-audit-log__card">
      <div className="il-audit-log__card-main">
        <strong className="il-audit-log__card-name">{entry.guestName || "—"}</strong>
        <span className="il-audit-log__card-meta">
          <AuditDescription entry={entry} />
        </span>
        <span className="il-audit-log__card-meta il-audit-log__card-meta--secondary">
          {[
            `ע״י ${performer}`,
            countLabel,
            timeLabel
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {status ? (
        <span className={`il-audit-log__status ${statusBadgeClass(status)}`}>{status}</span>
      ) : (
        <span className={`il-audit-log__badge ${performerBadgeClass(entry)}`}>{performer}</span>
      )}
    </article>
  );
}

function renderStructuredDescription(entry) {
  const status = getStatusFromEntry(entry);
  const count = getCountFromEntry(entry);
  const notes = entry?.metadata?.agentNotes || "";
  const round = entry?.metadata?.attemptNumber || entry?.metadata?.callRound || 1;
  const callStatus = entry?.metadata?.callStatus || entry?.changes?.callStatus;

  if (entry.actor === "agent" && entry.channel === "phone" && callStatus) {
    if (callStatus === "answered" && status) {
      return (
        <>
          שיחה טלפונית (<Bold>סבב {round}</Bold>): סטטוס עודכן ל-
          <Bold>{status}</Bold>
          <GuestCountPart status={status} count={count} />
          <NotesPart notes={notes} />
        </>
      );
    }

    if (callStatus === "disconnected") {
      return (
        <>
          שיחה טלפונית (<Bold>סבב {round}</Bold>): השיחה נותקה
          <NotesPart notes={notes} />
        </>
      );
    }

    if (callStatus === "no_answer") {
      return (
        <>
          שיחה טלפונית (<Bold>סבב {round}</Bold>): לא היה מענה
          <NotesPart notes={notes} />
        </>
      );
    }
  }

  if (entry.actor === "guest" && status) {
    return (
      <>
        אישור הגעה עצמאי: עודכן ל-
        <Bold>{status}</Bold>
        <GuestCountPart status={status} count={count} />
      </>
    );
  }

  if (entry.actor === "client" && entry.action === "guest_created" && status) {
    return (
      <>
        הוספת מוזמן: <Bold>{status}</Bold>
        <GuestCountPart status={status} count={count} />
      </>
    );
  }

  if (entry.actor === "hostess" && entry.action === "guest_created" && status) {
    return (
      <>
        הוספת מוזמן ע״י דיילת (לא היה ברשימת המוזמנים): <Bold>{status}</Bold>
        <GuestCountPart status={status} count={count} />
      </>
    );
  }

  if (entry.actor === "hostess" && status) {
    return (
      <>
        עודכן ע״י דיילת אירוע: <Bold>{status}</Bold>
        <GuestCountPart status={status} count={count} />
      </>
    );
  }

  if (entry.actor === "client" && status) {
    const prefix =
      entry.channel === "import" ? 'עודכן ע"י הזוג (ייבוא אקסל): ' : 'עודכן ע"י הזוג: ';
    return (
      <>
        {prefix}
        <Bold>{status}</Bold>
        <GuestCountPart status={status} count={count} />
      </>
    );
  }

  return null;
}

function AuditDescription({ entry }) {
  const structured = renderStructuredDescription(entry);
  if (structured) return structured;
  return renderBoldMarkedText(entry.description);
}

export default function GuestAuditLogTable({
  userId,
  apiPrefix = "client",
  title = "לוג עדכונים ושינויים",
  enableLiveUpdates = false,
  showHeader = true,
  fullPage = false
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
    <section
      className={`il-audit-log${fullPage ? " il-audit-log--full-page" : ""}`}
      dir="rtl"
      lang="he"
      aria-label={title}
    >
      {showHeader ? (
        <div className="il-audit-log__header">
          <h2>{title}</h2>
          <p>מעקב בזמן אמת אחר שינויי סטטוס, כמות מגיעים ושיחות טלפון לכל מוזמן.</p>
        </div>
      ) : null}

      {error ? <p className="il-audit-log__error">{error}</p> : null}

      <div className="il-audit-log__cards" aria-label="רשימת עדכונים לנייד">
        {loading && !entries.length ? (
          <p className="il-audit-log__empty">טוען עדכונים…</p>
        ) : null}
        {!loading && !entries.length ? (
          <p className="il-audit-log__empty">אין עדכונים עדיין</p>
        ) : null}
        {entries.map((entry) => (
          <AuditMobileCard key={`card-${entry._id}`} entry={entry} />
        ))}
      </div>

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
                    <span dir="ltr">{entry.guestPhone || "—"}</span>
                  </td>
                  <td className="il-audit-log__description">
                    <AuditDescription entry={entry} />
                  </td>
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
