import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import api from "../api";
import { clearEventManagerToken } from "../utils/eventManagerAuth";
import { formatIsraeliDate } from "../utils/dateFormat";
import "../us/admin-portal.css";

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

function buildEventDisplayText(event) {
  if (!event) return "";
  if (event.eventType === "חתונה") return `${event.groomName} & ${event.brideName}`.trim();
  if (event.eventType === "ברית") return `${event.parentName1} ו${event.parentName2}`.trim();
  if (event.eventType === "בת מצווה") return `${event.batMitzvahName || ""}`.trim();
  return event.eventNames || "";
}

export default function EventManagerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [editingClientId, setEditingClientId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [error, setError] = useState("");
  const [clientsError, setClientsError] = useState("");
  const [welcomeNotice, setWelcomeNotice] = useState("");

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.userId) === String(selectedClientId)) || null,
    [clients, selectedClientId]
  );

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

  function openEditWizard(client) {
    const event = client.event || {};
    setWizardMode("edit");
    setEditingClientId(client.userId);
    setForm({
      username: client.username || "",
      password: "",
      contactPhone: client.contactPhone || "",
      eventType: event.eventType || "חתונה",
      groomName: event.groomName || "",
      brideName: event.brideName || "",
      batMitzvahName: event.batMitzvahName || "",
      parentName1: event.parentName1 || "",
      parentName2: event.parentName2 || "",
      venueName: event.venueName || "",
      city: event.city || "",
      streetAndNumber: event.streetAndNumber || "",
      eventDate: event.eventDate || "",
      eventDateHebrew: event.eventDateHebrew || "",
      eventTime: event.eventTime || "",
      imageDataUrl: event.imageDataUrl || ""
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
        const response = await api.patch(`/manager/clients/${editingClientId}`, payload);
        setResult(response.data);
        setSelectedClientId(editingClientId);
        setWelcomeNotice("");
      } else {
        const response = await api.post("/manager/create-client", payload);
        setResult(response.data);
        setSelectedClientId(response.data.userId);
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

  async function deleteClient(client) {
    const label = buildEventDisplayText(client.event) || client.username;
    if (!window.confirm(`למחוק את האירוע של ${label}?`)) return;
    try {
      await api.delete(`/manager/clients/${client.userId}`);
      if (String(selectedClientId) === String(client.userId)) {
        setSelectedClientId("");
        setResult(null);
      }
      await loadClients();
    } catch (deleteError) {
      setClientsError(deleteError.response?.data?.message || "מחיקה נכשלה");
    }
  }

  function logout() {
    clearEventManagerToken();
    navigate("/manager/login");
  }

  return (
    <div className="us-admin-portal us-admin-shell" dir="rtl" lang="he">
      <header className="us-admin-header">
        <div>
          <h1>מנהל אירועים — Partner</h1>
          <p>יצירת זוגות וניהול אירועים · ללא הקצאת קופונים</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="us-admin-btn us-admin-btn--primary" type="button" onClick={openCreateWizard}>
            פתיחת אירוע חדש
          </button>
          <button className="us-admin-btn" type="button" onClick={logout}>
            התנתקות
          </button>
        </div>
      </header>

      {clientsError ? <p className="us-admin-message us-admin-message--error">{clientsError}</p> : null}
      {welcomeNotice ? <p className="us-admin-message">{welcomeNotice}</p> : null}

      <div className="us-admin-layout">
        <div className="us-admin-card">
          <h2 className="us-admin-card-title">הזוגות שלי ({clients.length})</h2>
          <div className="us-admin-card-body">
            {loadingClients ? <p>טוען…</p> : null}
            <div className="us-admin-client-list">
              {clients.map((client) => {
                const label = buildEventDisplayText(client.event) || client.username;
                const isActive = String(client.userId) === String(selectedClientId);
                return (
                  <div key={client.userId} className={`us-admin-client-row${isActive ? " is-active" : ""}`}>
                    <button type="button" className="us-admin-client-main" onClick={() => setSelectedClientId(client.userId)}>
                      <strong>{label}</strong>
                      <span>{client.username}</span>
                      <span>{formatIsraeliDate(client.event?.eventDate) || "—"}</span>
                    </button>
                    <button
                      className="us-admin-btn us-admin-btn--xs"
                      type="button"
                      onClick={() => openEditWizard(client)}
                      aria-label="עריכה"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="us-admin-btn us-admin-btn--xs us-admin-btn--danger"
                      type="button"
                      onClick={() => deleteClient(client)}
                      aria-label="מחיקה"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              {!loadingClients && !clients.length ? <p>עדיין אין זוגות. פתחו אירוע חדש.</p> : null}
            </div>
          </div>
        </div>

        <div className="us-admin-card">
          <h2 className="us-admin-card-title">פרטי זוג</h2>
          <div className="us-admin-card-body">
            {selectedClient ? (
              <>
                <p>
                  <strong>{buildEventDisplayText(selectedClient.event) || selectedClient.username}</strong>
                </p>
                <p>
                  {selectedClient.event?.venueName || "—"}
                  {selectedClient.event?.city ? ` · ${selectedClient.event.city}` : ""}
                </p>
                <p>
                  משתמש: {selectedClient.username} · סיסמה:{" "}
                  {selectedClient.loginPassword || result?.credentials?.password || "—"}
                </p>
                <p>טלפון כלה: {selectedClient.contactPhone || "—"}</p>
                <p>
                  תאריך: {formatIsraeliDate(selectedClient.event?.eventDate) || "—"} · שעה:{" "}
                  {selectedClient.event?.eventTime || "—"}
                </p>
                <div className="us-admin-form-actions" style={{ marginTop: "1rem" }}>
                  <Link className="us-admin-btn us-admin-btn--primary" to={`/client/dashboard/${selectedClient.userId}`}>
                    טבלת אורחים
                  </Link>
                  <Link className="us-admin-btn" to={`/client/dashboard/${selectedClient.userId}/seating`}>
                    מערכת הושבה
                  </Link>
                  <a className="us-admin-btn" href={selectedClient.publicEventLink} target="_blank" rel="noreferrer">
                    הזמנה דיגיטלית
                  </a>
                </div>
              </>
            ) : (
              <p>בחרו זוג מהרשימה או פתחו אירוע חדש.</p>
            )}
          </div>
        </div>
      </div>

      {showCreateWizard ? (
        <div className="us-admin-modal-backdrop" role="presentation">
          <form className="us-admin-modal" onSubmit={onSubmitWizard}>
            <div className="us-admin-modal-header">
              <h2 className="us-admin-card-title" style={{ border: "none", padding: 0, background: "transparent" }}>
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
                <input className="us-admin-field-input" value={form.username} onChange={(e) => onFormChange("username", e.target.value)} required />
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
                <select className="us-admin-field-input" value={form.eventType} onChange={(e) => onFormChange("eventType", e.target.value)}>
                  <option value="חתונה">חתונה</option>
                  <option value="ברית">ברית</option>
                  <option value="בת מצווה">בת מצווה</option>
                  <option value="אחר">אחר</option>
                </select>
              </div>
              {form.eventType === "חתונה" ? (
                <>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label">שם חתן</label>
                    <input className="us-admin-field-input" value={form.groomName} onChange={(e) => onFormChange("groomName", e.target.value)} required />
                  </div>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label">שם כלה</label>
                    <input className="us-admin-field-input" value={form.brideName} onChange={(e) => onFormChange("brideName", e.target.value)} required />
                  </div>
                </>
              ) : null}
              {form.eventType === "ברית" ? (
                <>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label">הורה 1</label>
                    <input className="us-admin-field-input" value={form.parentName1} onChange={(e) => onFormChange("parentName1", e.target.value)} />
                  </div>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label">הורה 2</label>
                    <input className="us-admin-field-input" value={form.parentName2} onChange={(e) => onFormChange("parentName2", e.target.value)} />
                  </div>
                </>
              ) : null}
              {form.eventType === "בת מצווה" ? (
                <div className="us-admin-field">
                  <label className="us-admin-field-label">שם החוגגת</label>
                  <input className="us-admin-field-input" value={form.batMitzvahName} onChange={(e) => onFormChange("batMitzvahName", e.target.value)} />
                </div>
              ) : null}
              <div className="us-admin-field">
                <label className="us-admin-field-label">אולם</label>
                <input className="us-admin-field-input" value={form.venueName} onChange={(e) => onFormChange("venueName", e.target.value)} />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label">עיר</label>
                <input className="us-admin-field-input" value={form.city} onChange={(e) => onFormChange("city", e.target.value)} />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label">כתובת</label>
                <input className="us-admin-field-input" value={form.streetAndNumber} onChange={(e) => onFormChange("streetAndNumber", e.target.value)} />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label">תאריך</label>
                <input className="us-admin-field-input" type="date" value={form.eventDate} onChange={(e) => onFormChange("eventDate", e.target.value)} />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label">שעה</label>
                <input className="us-admin-field-input" value={form.eventTime} onChange={(e) => onFormChange("eventTime", e.target.value)} />
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
  );
}
