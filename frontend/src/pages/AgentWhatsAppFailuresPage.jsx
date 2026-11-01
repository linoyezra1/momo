import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import AgentWhatsAppFailures from "../components/AgentWhatsAppFailures.jsx";
import "../agent-workspace.css";

export default function AgentWhatsAppFailuresPage() {
  const { userId } = useParams();
  const [eventInfo, setEventInfo] = useState(null);
  const [eventLabel, setEventLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/agent/${userId}/guests`)
      .then((response) => {
        if (cancelled) return;
        setEventInfo(response.data?.event || null);
        setEventLabel(response.data?.eventLabel || "");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError.response?.data?.message || "טעינת האירוע נכשלה");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="agent-container agent-container--wide">
      <header className="agent-header agent-header--workspace">
        <div>
          <Link className="agent-back-link" to={`/agent/calls/${userId}`}>
            ← חזרה למרחב העבודה
          </Link>
          <h1>הודעות שלא נשלחו</h1>
          <p>{eventLabel ? `אירוע: ${eventLabel}` : "כשלי מסירה בוואטסאפ"}</p>
        </div>
      </header>

      {loading ? <p className="agent-muted">טוען…</p> : null}
      {error ? <p className="agent-error">{error}</p> : null}

      {!loading && !error && userId ? (
        <AgentWhatsAppFailures userId={userId} event={eventInfo} />
      ) : null}
    </div>
  );
}
