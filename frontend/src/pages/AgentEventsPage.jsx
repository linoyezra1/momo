import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, MessageCircle, Phone } from "lucide-react";
import api from "../api";
import { toInternationalWhatsAppPhone } from "../utils/whatsapp.js";

function buildCredentialsText(client) {
  return [
    "פרטי גישה למערכת momoEVENT",
    `שם משתמש: ${client.username || ""}`,
    `סיסמה: ${client.loginPassword || ""}`,
    client.contactPhone ? `טלפון: ${client.contactPhone}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function phoneTelHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+972${digits.slice(1)}`;
  return `tel:+${digits}`;
}

export default function AgentEventsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    api
      .get("/agent/clients")
      .then((response) => setClients(response.data?.clients || []))
      .catch((loadError) => setError(loadError.response?.data?.message || "טעינת אירועים נכשלה"))
      .finally(() => setLoading(false));
  }, []);

  const copyCredentials = async (client) => {
    const text = buildCredentialsText(client);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(client.userId);
      setTimeout(() => setCopiedId(""), 2000);
    } catch {
      setError("העתקה נכשלה");
    }
  };

  return (
    <div className="agent-container agent-container--wide">
      <header className="agent-header">
        <h1>האירועים שלי</h1>
        <p>פעולות מהירות מול הלקוחות שפתחתם</p>
      </header>

      {loading ? <p className="agent-muted">טוען…</p> : null}
      {error ? <p className="agent-error">{error}</p> : null}
      {!loading && !clients.length ? <p className="agent-muted">אין אירועים עדיין</p> : null}

      <div className="agent-events-list">
        {clients.map((client) => {
          const waPhone = toInternationalWhatsAppPhone(client.contactPhone);
          const telHref = phoneTelHref(client.contactPhone);
          return (
            <article key={client.userId} className="agent-event-card">
              <div className="agent-event-card__main">
                <h2>{client.eventLabel}</h2>
                <p className="agent-muted">
                  {client.eventType}
                  {client.eventDate ? ` · ${client.eventDate}` : ""}
                </p>
                <p className="agent-event-card__user">@{client.username}</p>
              </div>
              <div className="agent-event-card__actions">
                {waPhone ? (
                  <a
                    className="agent-quick-btn"
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </a>
                ) : null}
                {telHref ? (
                  <a className="agent-quick-btn" href={telHref}>
                    <Phone size={18} />
                    חיוג
                  </a>
                ) : null}
                <button
                  type="button"
                  className="agent-quick-btn"
                  onClick={() => copyCredentials(client)}
                >
                  <Copy size={18} />
                  {copiedId === client.userId ? "הועתק!" : "העתק גישה"}
                </button>
                <Link className="agent-quick-btn agent-quick-btn--primary" to={`/agent/calls/${client.userId}`}>
                  שיחות
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
