import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import api from "../api";
import { clearEventManagerToken } from "../utils/eventManagerAuth";
import { formatIsraeliDate, parseIsoDateParts } from "../utils/dateFormat";
import { buildTelHref, buildWhatsAppHref, formatIls } from "../utils/vendors";
import { isCoupleEventType } from "../utils/eventTypeWording";
import "../us/admin-portal.css";
import "../il/manager-dashboard.css";

const initialForm = {
  username: "",
  password: "",
  contactPhone: "",
  eventType: "חתונה",
  groomName: "",
  brideName: "",
  batMitzvahName: "",
  parentName1: "",
  parentName2: "",
  venueName: "",
  city: "",
  streetAndNumber: "",
  eventDate: "",
  eventDateHebrew: "",
  eventTime: "",
  imageDataUrl: ""
};

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "upcoming", label: "אירועים קרובים" },
  { id: "past", label: "הסתיימו" }
];

function buildEventDisplayText(event) {
  if (!event) return "";
  if (isCoupleEventType(event.eventType)) return `${event.groomName} & ${event.brideName}`.trim();
  if (event.eventType === "ברית") return `${event.parentName1} ו${event.parentName2}`.trim();
  if (event.eventType === "בת מצווה") return `${event.batMitzvahName || ""}`.trim();
  return event.eventNames || "";
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function eventDateObject(eventDate) {
  const parts = parseIsoDateParts(eventDate);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
}

function daysUntilEvent(eventDate) {
  const target = eventDateObject(eventDate);
  if (!target) return null;
  const today = startOfLocalDay();
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function countdownBadge(eventDate) {
  const days = daysUntilEvent(eventDate);
  if (days == null) return { label: "ללא תאריך", tone: "past" };
  if (days < 0) return { label: "הסתיים", tone: "past" };
  if (days === 0) return { label: "היום!", tone: "today" };
  if (days === 1) return { label: "מחר", tone: "soon" };
  return { label: `עוד ${days} ימים`, tone: "soon" };
}

function guestProgress(stats = {}) {
  const invited = Math.max(0, Number(stats.totalInvited) || 0);
  const coming = Math.max(0, Number(stats.totalComing) || 0);
  const pct = invited > 0 ? Math.min(100, Math.round((coming / invited) * 100)) : 0;
  return { invited, coming, pct };
}

export default function EventManagerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [editingClientId, setEditingClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [error, setError] = useState("");
  const [clientsError, setClientsError] = useState("");
  const [welcomeNotice, setWelcomeNotice] = useState("");

  async function loadClients() {
    setLoadingClients(true);
    setClientsError("");
    try {
      const response = await api.get("/manager/clients");
      setClients(response.data.clients || []);
    } catch (loadError) {
      setClientsError(loadError.response?.data?.message || "טעינת הזוגות נכשלה");
    } finally {
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((client) => {
      const days = daysUntilEvent(client.event?.eventDate);
      if (filter === "upcoming" && !(days != null && days >= 0)) return false;
      if (filter === "past" && !(days != null && days < 0)) return false;

      if (!q) return true;
      const label = buildEventDisplayText(client.event).toLowerCase();
      const phone = String(client.contactPhone || "").toLowerCase();
      const username = String(client.username || "").toLowerCase();
      const venue = String(client.event?.venueName || "").toLowerCase();
      return (
        label.includes(q) ||
        phone.includes(q) ||
        username.includes(q) ||
        venue.includes(q)
      );
    });
  }, [clients, filter, query]);

  function onFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openCreateWizard() {
    setWizardMode("create");
    setEditingClientId("");
    setForm(initialForm);
    setError("");
    setShowCreateWizard(true);
  }

  function openEditWizard(client, event) {
    event?.stopPropagation?.();
    const ev = client.event || {};
    setWizardMode("edit");
    setEditingClientId(client.userId);
    setForm({
      username: client.username || "",
      password: "",
      contactPhone: client.contactPhone || "",
      eventType: ev.eventType || "חתונה",
      groomName: ev.groomName || "",
      brideName: ev.brideName || "",
      batMitzvahName: ev.batMitzvahName || "",
      parentName1: ev.parentName1 || "",
      parentName2: ev.parentName2 || "",
      venueName: ev.venueName || "",
      city: ev.city || "",
      streetAndNumber: ev.streetAndNumber || "",
      eventDate: ev.eventDate || "",
      eventDateHebrew: ev.eventDateHebrew || "",
      eventTime: ev.eventTime || "",
      imageDataUrl: ev.imageDataUrl || ""
    });
    setError("");
    setShowCreateWizard(true);
  }

  async function onSubmitWizard(submitEvent) {
    submitEvent.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        username: form.username,
        password: form.password,
        contactPhone: form.contactPhone,
        event: {
          eventType: form.eventType,
          groomName: form.groomName,
          brideName: form.brideName,
          batMitzvahName: form.batMitzvahName,
          parentName1: form.parentName1,
          parentName2: form.parentName2,
          venueName: form.venueName,
          city: form.city,
          streetAndNumber: form.streetAndNumber,
          eventDate: form.eventDate,
          eventDateHebrew: form.eventDateHebrew,
          eventTime: form.eventTime,
          imageDataUrl: form.imageDataUrl
        }
      };

      if (wizardMode === "edit") {
        if (!payload.password) delete payload.password;
        await api.patch(`/manager/clients/${editingClientId}`, payload);
        setWelcomeNotice("");
      } else {
        const response = await api.post("/manager/create-client", payload);
        if (response.data?.welcomeWhatsApp?.sent) {
          setWelcomeNotice("הודעת וואטסאפ עם פרטי הגישה נשלחה לכלה");
        } else if (response.data?.welcomeWhatsApp?.reason === "twilio_not_configured") {
          setWelcomeNotice("החשבון נוצר, אך Twilio לא מוגדר — הודעת הוואטסאפ לא נשלחה");
        } else if (response.data?.welcomeWhatsApp?.reason === "invalid_phone") {
          setWelcomeNotice("החשבון נוצר, אך מספר הטלפון לא תקין לשליחת וואטסאפ");
        } else {
          setWelcomeNotice("החשבון נוצר, אך שליחת הודעת הוואטסאפ נכשלה");
        }
      }
      setShowCreateWizard(false);
      await loadClients();
    } catch (submitError) {
      setError(submitError.response?.data?.message || "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  async function deleteClient(client, event) {
    event?.stopPropagation?.();
    const label = buildEventDisplayText(client.event) || client.username;
    if (!window.confirm(`למחוק את האירוע של ${label}?`)) return;
    try {
      await api.delete(`/manager/clients/${client.userId}`);
      await loadClients();
    } catch (deleteError) {
      setClientsError(deleteError.response?.data?.message || "מחיקה נכשלה");
    }
  }

  function openEvent(userId) {
    navigate(`/manager/events/${userId}/vendors`);
  }

  function logout() {
    clearEventManagerToken();
    navigate("/manager/login");
  }

  return (
    <div className="mgr-dash" dir="rtl" lang="he">
      <div className="mgr-dash__container">
        <header className="mgr-dash__header">
          <div>
            <p className="mgr-dash__eyebrow">momoEVENT · Partner</p>
            <h1 className="mgr-dash__title">לוח אירועים</h1>
            <p className="mgr-dash__subtitle">
              {clients.length} אירועים · לחצו על כרטיס לפתיחת ניהול מלא
            </p>
          </div>
          <div className="mgr-dash__header-actions">
            <Link className="mgr-dash__btn" to="/manager/vendors">
              מאגר ספקים
            </Link>
            <button className="mgr-dash__btn mgr-dash__btn--primary" type="button" onClick={openCreateWizard}>
              <Plus size={16} aria-hidden />
              פתיחת אירוע חדש
            </button>
            <button className="mgr-dash__btn" type="button" onClick={logout}>
              התנתקות
            </button>
          </div>
        </header>

        {clientsError ? (
          <p className="mgr-dash__message mgr-dash__message--error" style={{ marginBottom: "1rem" }}>
            {clientsError}
          </p>
        ) : null}
        {welcomeNotice ? (
          <p className="mgr-dash__message mgr-dash__message--ok" style={{ marginBottom: "1rem" }}>
            {welcomeNotice}
          </p>
        ) : null}

        <div className="mgr-dash__toolbar">
          <input
            className="mgr-dash__search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם זוג, טלפון, משתמש או אולם…"
            aria-label="חיפוש אירועים"
          />
          <div className="mgr-dash__filters" role="tablist" aria-label="סינון אירועים">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`mgr-dash__chip${filter === item.id ? " is-active" : ""}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loadingClients ? <p className="mgr-dash__empty">טוען אירועים…</p> : null}

        {!loadingClients && !filteredClients.length ? (
          <p className="mgr-dash__empty">
            {clients.length
              ? "לא נמצאו אירועים לפי החיפוש או הסינון."
              : "עדיין אין זוגות. פתחו אירוע חדש כדי להתחיל."}
          </p>
        ) : null}

        <div className="mgr-dash__grid">
          {filteredClients.map((client) => {
            const label = buildEventDisplayText(client.event) || client.username;
            const countdown = countdownBadge(client.event?.eventDate);
            const progress = guestProgress(client.stats);
            const waHref = buildWhatsAppHref(client.contactPhone);
            const telHref = buildTelHref(client.contactPhone);
            const booked = Number(client.stats?.bookedVendors) || 0;
            const quote = Number(client.stats?.totalVendorQuote) || 0;

            return (
              <article
                key={client.userId}
                className="mgr-event-card"
                role="link"
                tabIndex={0}
                onClick={() => openEvent(client.userId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEvent(client.userId);
                  }
                }}
                aria-label={`פתיחת ניהול אירוע ${label}`}
              >
                <div className="mgr-event-card__top">
                  <div>
                    <h2 className="mgr-event-card__names">{label}</h2>
                    <p className="mgr-event-card__meta">
                      {formatIsraeliDate(client.event?.eventDate) || "ללא תאריך"}
                      {client.event?.venueName ? ` · ${client.event.venueName}` : ""}
                      {client.event?.city ? ` · ${client.event.city}` : ""}
                    </p>
                  </div>
                  <div className="mgr-event-card__badges">
                    <span className="mgr-badge mgr-badge--type">{client.event?.eventType || "אירוע"}</span>
                    <span className={`mgr-badge mgr-badge--${countdown.tone}`}>{countdown.label}</span>
                  </div>
                </div>

                <div className="mgr-event-card__stats">
                  <div>
                    <div className="mgr-event-card__stat-row">
                      <strong>
                        {progress.coming} / {progress.invited}
                      </strong>
                      <span>מגיעים מתוך מוזמנים</span>
                    </div>
                    <div className="mgr-progress" aria-hidden>
                      <div className="mgr-progress__bar" style={{ width: `${progress.pct}%` }} />
                    </div>
                  </div>
                  <div className="mgr-event-card__stat-row">
                    <strong>
                      {booked} ספקים נסגרו
                      {quote > 0 ? ` · ${formatIls(quote)}` : ""}
                    </strong>
                    <span>ספקים</span>
                  </div>
                </div>

                <div className="mgr-event-card__footer">
                  <div className="mgr-event-card__quick">
                    <a
                      className="mgr-icon-btn"
                      href={waHref || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="וואטסאפ לזוג"
                      title="וואטסאפ"
                      aria-disabled={!waHref}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!waHref) e.preventDefault();
                      }}
                    >
                      <MessageCircle size={16} />
                    </a>
                    <a
                      className="mgr-icon-btn"
                      href={telHref || undefined}
                      aria-label="חיוג לזוג"
                      title="חיוג"
                      aria-disabled={!telHref}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!telHref) e.preventDefault();
                      }}
                    >
                      <Phone size={16} />
                    </a>
                    <button
                      className="mgr-icon-btn"
                      type="button"
                      aria-label="עריכת אירוע"
                      title="עריכה"
                      onClick={(e) => openEditWizard(client, e)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="mgr-icon-btn mgr-icon-btn--danger"
                      type="button"
                      aria-label="מחיקת אירוע"
                      title="מחיקה"
                      onClick={(e) => deleteClient(client, e)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <span className="mgr-event-card__cta">ניהול אירוע ←</span>
                </div>
              </article>
            );
          })}
        </div>

        {showCreateWizard ? (
          <div className="us-admin-modal-backdrop" role="presentation">
            <form className="us-admin-modal" onSubmit={onSubmitWizard}>
              <div className="us-admin-modal-header">
                <h2
                  className="us-admin-card-title"
                  style={{ border: "none", padding: 0, background: "transparent" }}
                >
                  {wizardMode === "edit" ? "עריכת אירוע" : "פתיחת אירוע חדש"}
                </h2>
                <button
                  className="us-admin-modal-close"
                  type="button"
                  onClick={() => setShowCreateWizard(false)}
                  aria-label="סגירה"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="us-admin-card-body">
                <div className="us-admin-field">
                  <label className="us-admin-field-label">שם משתמש</label>
                  <input
                    className="us-admin-field-input"
                    value={form.username}
                    onChange={(e) => onFormChange("username", e.target.value)}
                    required
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">
                    סיסמה {wizardMode === "edit" ? "(ריק = ללא שינוי)" : ""}
                  </label>
                  <input
                    className="us-admin-field-input"
                    type="text"
                    value={form.password}
                    onChange={(e) => onFormChange("password", e.target.value)}
                    required={wizardMode === "create"}
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">
                    טלפון הכלה (איש קשר) {wizardMode === "create" ? "*" : ""}
                  </label>
                  <input
                    className="us-admin-field-input"
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => onFormChange("contactPhone", e.target.value)}
                    placeholder="05XXXXXXXX"
                    required={wizardMode === "create"}
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">סוג אירוע</label>
                  <select
                    className="us-admin-field-input"
                    value={form.eventType}
                    onChange={(e) => onFormChange("eventType", e.target.value)}
                  >
                    <option value="חתונה">חתונה</option>
                    <option value="חינה">חינה</option>
                    <option value="אירוסין">אירוסין</option>
                    <option value="ברית">ברית</option>
                    <option value="בת מצווה">בת מצווה</option>
                    <option value="אחר">אחר</option>
                  </select>
                </div>
                {isCoupleEventType(form.eventType) ? (
                  <>
                    <div className="us-admin-field">
                      <label className="us-admin-field-label">שם חתן</label>
                      <input
                        className="us-admin-field-input"
                        value={form.groomName}
                        onChange={(e) => onFormChange("groomName", e.target.value)}
                        required
                      />
                    </div>
                    <div className="us-admin-field">
                      <label className="us-admin-field-label">שם כלה</label>
                      <input
                        className="us-admin-field-input"
                        value={form.brideName}
                        onChange={(e) => onFormChange("brideName", e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : null}
                {form.eventType === "ברית" ? (
                  <>
                    <div className="us-admin-field">
                      <label className="us-admin-field-label">הורה 1</label>
                      <input
                        className="us-admin-field-input"
                        value={form.parentName1}
                        onChange={(e) => onFormChange("parentName1", e.target.value)}
                      />
                    </div>
                    <div className="us-admin-field">
                      <label className="us-admin-field-label">הורה 2</label>
                      <input
                        className="us-admin-field-input"
                        value={form.parentName2}
                        onChange={(e) => onFormChange("parentName2", e.target.value)}
                      />
                    </div>
                  </>
                ) : null}
                {form.eventType === "בת מצווה" ? (
                  <div className="us-admin-field">
                    <label className="us-admin-field-label">שם החוגגת</label>
                    <input
                      className="us-admin-field-input"
                      value={form.batMitzvahName}
                      onChange={(e) => onFormChange("batMitzvahName", e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="us-admin-field">
                  <label className="us-admin-field-label">אולם</label>
                  <input
                    className="us-admin-field-input"
                    value={form.venueName}
                    onChange={(e) => onFormChange("venueName", e.target.value)}
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">עיר</label>
                  <input
                    className="us-admin-field-input"
                    value={form.city}
                    onChange={(e) => onFormChange("city", e.target.value)}
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">כתובת</label>
                  <input
                    className="us-admin-field-input"
                    value={form.streetAndNumber}
                    onChange={(e) => onFormChange("streetAndNumber", e.target.value)}
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">תאריך</label>
                  <input
                    className="us-admin-field-input"
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => onFormChange("eventDate", e.target.value)}
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">שעה</label>
                  <input
                    className="us-admin-field-input"
                    value={form.eventTime}
                    onChange={(e) => onFormChange("eventTime", e.target.value)}
                  />
                </div>
                {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}
                <div className="us-admin-form-actions">
                  <button className="us-admin-btn us-admin-btn--primary" disabled={loading} type="submit">
                    {loading ? "שומר…" : wizardMode === "edit" ? "עדכון" : "יצירה"}
                  </button>
                  <button className="us-admin-btn" type="button" onClick={() => setShowCreateWizard(false)}>
                    ביטול
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
