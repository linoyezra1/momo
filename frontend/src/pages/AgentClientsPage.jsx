import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import api from "../api";
import "../agent-workspace.css";

function clientMatchesQuery(client, query) {
  const trimmed = String(query || "").trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    client.eventLabel,
    client.eventType,
    client.eventDate,
    client.username,
    client.contactPhone,
    client.event?.groomName,
    client.event?.brideName,
    client.event?.batMitzvahName,
    client.event?.parentName1,
    client.event?.parentName2,
    client.event?.organizerName,
    client.event?.conferenceBrandName,
    client.event?.venueName,
    client.event?.city
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes(trimmed)) return true;

  const queryDigits = trimmed.replace(/\D/g, "");
  if (queryDigits) {
    const phoneDigits = String(client.contactPhone || "").replace(/\D/g, "");
    if (phoneDigits.includes(queryDigits)) return true;
  }

  return false;
}

export default function AgentClientsPage() {
  const [clients, setClients] = useState([]);
  const [scope, setScope] = useState("owned");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api
      .get("/agent/clients")
      .then((response) => {
        setClients(response.data?.clients || []);
        setScope(response.data?.scope === "all" ? "all" : "owned");
      })
      .catch((loadError) => setError(loadError.response?.data?.message || "טעינת לקוחות נכשלה"))
      .finally(() => setLoading(false));
  }, []);

  const filteredClients = useMemo(
    () => clients.filter((client) => clientMatchesQuery(client, searchQuery)),
    [clients, searchQuery]
  );

  return (
    <div className="agent-container">
      <header className="agent-header">
        <h1>מרכז שיחות</h1>
        <p>
          {scope === "all"
            ? "בחרו אירוע מכל האירועים במערכת לניהול אישורי הגעה טלפוניים"
            : "בחרו אירוע לניהול אישורי הגעה טלפוניים (רק האירועים שלכם)"}
        </p>
      </header>

      {!loading && clients.length ? (
        <label className="agent-events-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="חיפוש זוג / אירוע לפי שם, תאריך, טלפון…"
            aria-label="חיפוש זוג או אירוע"
          />
          {searchQuery ? (
            <button
              type="button"
              className="agent-events-search__clear"
              aria-label="נקה חיפוש"
              onClick={() => setSearchQuery("")}
            >
              <X size={16} />
            </button>
          ) : null}
        </label>
      ) : null}

      {loading ? <p className="agent-muted">טוען רשימת אירועים…</p> : null}
      {error ? <p className="agent-error">{error}</p> : null}

      {!loading && !clients.length ? (
        <p className="agent-muted">אין אירועים משויכים. פתחו לקוח חדש בלשונית דשבורד.</p>
      ) : null}

      {!loading && clients.length && !filteredClients.length ? (
        <p className="agent-muted">לא נמצאו אירועים התואמים לחיפוש</p>
      ) : null}

      <div className="agent-client-grid">
        {filteredClients.map((client) => (
          <Link
            key={client.userId}
            className="agent-client-card"
            to={`/agent/calls/${client.userId}`}
          >
            <h2>{client.eventLabel}</h2>
            <p>{client.eventType || "אירוע"}</p>
            {client.eventDate ? <p className="agent-client-card__date">{client.eventDate}</p> : null}
            <span className="agent-client-card__cta">פתיחת רשימת מוזמנים</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
