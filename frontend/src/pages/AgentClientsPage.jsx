import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../agent-workspace.css";

export default function AgentClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/agent/clients")
      .then((response) => setClients(response.data?.clients || []))
      .catch((loadError) => setError(loadError.response?.data?.message || "טעינת לקוחות נכשלה"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="agent-shell" dir="rtl">
      <div className="agent-container">
        <header className="agent-header">
          <h1>מרחב נציג — בחירת אירוע</h1>
          <p>בחרו אירוע כדי לנהל אישורי הגעה טלפוניים</p>
        </header>

        {loading ? <p className="agent-muted">טוען רשימת אירועים…</p> : null}
        {error ? <p className="agent-error">{error}</p> : null}

        {!loading && !clients.length ? <p className="agent-muted">אין אירועים פעילים</p> : null}

        <div className="agent-client-grid">
          {clients.map((client) => (
            <Link
              key={client.userId}
              className="agent-client-card"
              to={`/agent/workspace/${client.userId}`}
            >
              <h2>{client.eventLabel}</h2>
              <p>{client.eventType || "אירוע"}</p>
              {client.eventDate ? <p className="agent-client-card__date">{client.eventDate}</p> : null}
              <span className="agent-client-card__cta">פתיחת רשימת מוזמנים</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
