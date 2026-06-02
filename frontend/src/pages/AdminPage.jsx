import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import api from "../api";
import { buildClientOnboardingMessage } from "../utils/clientOnboardingMessage";

const initialForm = {
  username: "",
  password: "",
  eventType: "חתונה",
  groomName: "",
  brideName: "",
  parentName1: "",
  parentName2: "",
  venueName: "",
  city: "",
  streetAndNumber: "",
  eventDate: "",
  eventTime: "",
  imageDataUrl: ""
};

function toAppUrl(linkOrPath) {
  if (!linkOrPath) return "";
  try {
    const currentOrigin = window.location.origin;
    const parsed = new URL(linkOrPath, currentOrigin);
    return `${currentOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return linkOrPath;
  }
}

function buildEventDisplayText(event) {
  if (!event) return "";
  if (event.eventType === "חתונה") {
    return `${event.groomName} & ${event.brideName}`.trim();
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1} ו${event.parentName2}`.trim();
  }
  return "";
}

export default function AdminPage() {
  const [form, setForm] = useState(initialForm);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [editingClientId, setEditingClientId] = useState("");
  const [result, setResult] = useState(null);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [copyDone, setCopyDone] = useState(false);
  const [clientMessageCopied, setClientMessageCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [error, setError] = useState("");
  const [clientsError, setClientsError] = useState("");
  const publicEventUrl = toAppUrl(result?.publicEventLink);
  const clientDashboardUrl = toAppUrl(result?.clientDashboardLink);
  const eventDisplayText = buildEventDisplayText(createdEvent);
  const selectedClient = useMemo(
    () => clients.find((client) => String(client.userId) === String(selectedClientId)) || null,
    [clients, selectedClientId]
  );
  const shareMessage = createdEvent
    ? `הזמנה לאירוע ${createdEvent.eventType} של ${eventDisplayText}
תאריך: ${createdEvent.eventDate} | שעה: ${createdEvent.eventTime}
מיקום: ${createdEvent.venueName}, ${createdEvent.city}, ${createdEvent.streetAndNumber}

נא אשרו הגעה בקישור:
${publicEventUrl}`
    : "";
  const passwordHintForSelected = useMemo(() => {
    if (
      result?.credentials?.password &&
      selectedClient &&
      String(result.userId) === String(selectedClient.userId)
    ) {
      return result.credentials.password;
    }
    return "הסיסמה שהוגדרה בעת יצירת החשבון";
  }, [result, selectedClient]);

  const clientMessageForSelected = useMemo(() => {
    if (!selectedClient) return "";
    return buildClientOnboardingMessage({
      username: selectedClient.username,
      passwordHint: passwordHintForSelected,
      publicEventUrl: toAppUrl(selectedClient.publicEventLink),
      clientDashboardUrl: toAppUrl(selectedClient.clientDashboardLink)
    });
  }, [selectedClient, passwordHintForSelected]);

  const finalClientMessage =
    result && createdEvent
      ? buildClientOnboardingMessage({
          username: result.credentials?.username || form.username,
          passwordHint: result.credentials?.password || "עודכנה",
          publicEventUrl,
          clientDashboardUrl
        })
      : "";

  const loadClients = async () => {
    setLoadingClients(true);
    setClientsError("");
    try {
      const response = await api.get("/admin/clients");
      setClients(response.data.clients || []);
      if (!selectedClientId && response.data.clients?.length) {
        setSelectedClientId(response.data.clients[0].userId);
      }
    } catch (loadError) {
      setClientsError(loadError.response?.data?.message || "טעינת לקוחות נכשלה");
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({ ...prev, imageDataUrl: "" }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("יש לבחור קובץ תמונה בלבד");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("התמונה גדולה מדי. העלו תמונה עד 8MB");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const resultData = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, imageDataUrl: resultData }));
    };
    reader.onerror = () => setError("נכשלה קריאת קובץ התמונה");
    reader.readAsDataURL(file);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setCreatedEvent(null);
    setCopyDone(false);
    setLoading(true);

    try {
      const payload = {
        username: form.username,
        event: {
          eventType: form.eventType,
          groomName: form.eventType === "חתונה" ? form.groomName : "",
          brideName: form.eventType === "חתונה" ? form.brideName : "",
          parentName1: form.eventType === "ברית" ? form.parentName1 : "",
          parentName2: form.eventType === "ברית" ? form.parentName2 : "",
          venueName: form.venueName,
          city: form.city,
          streetAndNumber: form.streetAndNumber,
          eventDate: form.eventDate,
          eventTime: form.eventTime,
          imageDataUrl: form.imageDataUrl
        }
      };
      if (wizardMode === "create" || form.password.trim()) {
        payload.password = form.password;
      }
      const response =
        wizardMode === "edit"
          ? await api.patch(`/admin/clients/${editingClientId}`, payload)
          : await api.post("/admin/create-client", payload);
      setResult(response.data);
      setCreatedEvent(payload.event);
      setSelectedClientId(response.data.userId);
      setForm(initialForm);
      setShowCreateWizard(false);
      setWizardMode("create");
      setEditingClientId("");
      await loadClients();
    } catch (submitError) {
      setError(submitError.response?.data?.message || "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const closeWizard = () => {
    setShowCreateWizard(false);
    setWizardMode("create");
    setEditingClientId("");
    setForm(initialForm);
  };

  const openCreateWizard = () => {
    setForm(initialForm);
    setWizardMode("create");
    setEditingClientId("");
    setShowCreateWizard(true);
  };

  const deleteClient = async (client, clickEvent) => {
    clickEvent.stopPropagation();
    const confirmed = window.confirm("האם אתה בטוח שברצונך למחוק את הלקוח ואת כל נתוני האירוע?");
    if (!confirmed) return;

    setError("");
    try {
      await api.delete(`/admin/clients/${client.userId}`);
      if (String(selectedClientId) === String(client.userId)) {
        setSelectedClientId("");
      }
      await loadClients();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "מחיקת לקוח נכשלה");
    }
  };

  const openEditWizard = (client) => {
    setWizardMode("edit");
    setEditingClientId(client.userId);
    setForm({
      username: client.username || "",
      password: "",
      eventType: client.event?.eventType || "חתונה",
      groomName: client.event?.groomName || "",
      brideName: client.event?.brideName || "",
      parentName1: client.event?.parentName1 || "",
      parentName2: client.event?.parentName2 || "",
      venueName: client.event?.venueName || "",
      city: client.event?.city || "",
      streetAndNumber: client.event?.streetAndNumber || "",
      eventDate: client.event?.eventDate || "",
      eventTime: client.event?.eventTime || "",
      imageDataUrl: client.event?.imageDataUrl || ""
    });
    setShowCreateWizard(true);
  };

  const copyShareMessage = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1800);
    } catch {
      setError("לא הצלחנו להעתיק את הודעת השיתוף");
    }
  };

  const copyClientMessage = async (message) => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setClientMessageCopied(true);
    window.setTimeout(() => setClientMessageCopied(false), 2000);
  };

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <h1>מרכז ניהול אירועים</h1>
          <p>רשימת הלקוחות ודפי הנחיתה הפעילים</p>
        </header>

        <div className="toolbar">
          <button className="btn btn-primary" type="button" onClick={openCreateWizard}>
            לקוח חדש
          </button>
        </div>

        {error ? <p className="message message--error">{error}</p> : null}

        <section className="admin-layout">
          <div className="card">
            <h2 className="card-title">לקוחות פעילים</h2>
            {loadingClients ? <p>טוען רשימה…</p> : null}
            {clientsError ? <p className="message message--error">{clientsError}</p> : null}
            <div className="admin-client-list">
              {clients.map((client) => (
                <div key={client.userId} className={`admin-client-row ${String(selectedClientId) === String(client.userId) ? "is-active" : ""}`}>
                  <button className="admin-client-main" type="button" onClick={() => setSelectedClientId(client.userId)}>
                    <strong>{client.username}</strong>
                    <span>{client.event?.eventType || "אירוע"}</span>
                  </button>
                  <button className="btn btn-secondary btn-xs" type="button" onClick={() => openEditWizard(client)} aria-label="עריכת לקוח">
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn btn-delete btn-xs"
                    type="button"
                    onClick={(event) => deleteClient(client, event)}
                    aria-label="מחיקת לקוח"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">אזור אישי ללקוח</h2>
            {!selectedClient ? (
              <p>בחרו לקוח להצגת פרטים</p>
            ) : (
              <div className="form-stack">
                <p>
                  <strong>סוג אירוע:</strong> {selectedClient.event?.eventType}
                </p>
                <p>
                  <strong>שמות:</strong>{" "}
                  {buildEventDisplayText(selectedClient.event) || selectedClient.event?.eventNames || "-"}
                </p>
                <p>
                  <strong>תאריך:</strong> {selectedClient.event?.eventDate}
                </p>
                <p>
                  <strong>שעה:</strong> {selectedClient.event?.eventTime}
                </p>
                <p>
                  <strong>מיקום:</strong> {selectedClient.event?.venueName}, {selectedClient.event?.city},{" "}
                  {selectedClient.event?.streetAndNumber}
                </p>
                {selectedClient.event?.imageDataUrl ? (
                  <img className="event-image-preview" src={selectedClient.event.imageDataUrl} alt="תמונת קאבר" />
                ) : null}
                <p>
                  <strong>קישור ציבורי:</strong>{" "}
                  <a href={toAppUrl(selectedClient.publicEventLink)} target="_blank" rel="noreferrer">
                    {toAppUrl(selectedClient.publicEventLink)}
                  </a>
                </p>
                <p>
                  <strong>קישור דשבורד:</strong>{" "}
                  <a href={toAppUrl(selectedClient.clientDashboardLink)} target="_blank" rel="noreferrer">
                    {toAppUrl(selectedClient.clientDashboardLink)}
                  </a>
                </p>

                <div className="share-block share-block--persistent">
                  <p className="share-title">הודעה מוכנה ללקוח (להעתקה לוואטסאפ):</p>
                  <textarea className="field-input share-textarea" value={clientMessageForSelected} readOnly />
                  <button className="btn btn-primary" type="button" onClick={() => copyClientMessage(clientMessageForSelected)}>
                    {clientMessageCopied ? "הודעה הועתקה" : "העתק הודעה ללקוח"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {showCreateWizard ? (
          <div className="modal-backdrop" role="presentation">
            <form className="card modal-card modal-card-scroll form-stack" onSubmit={onSubmit}>
              <div className="modal-header-row">
                <h2 className="card-title">{wizardMode === "edit" ? "עריכת לקוח" : "אשף יצירת לקוח חדש"}</h2>
                <button className="modal-close-btn" type="button" onClick={closeWizard} aria-label="סגירה">
                  <X size={18} />
                </button>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="username">
                  שם משתמש
                </label>
                <input
                  id="username"
                  className="field-input"
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="password">
                  סיסמה {wizardMode === "edit" ? "(השאירו ריק לשמירת הסיסמה הקיימת)" : ""}
                </label>
                <input
                  id="password"
                  className="field-input"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  required={wizardMode === "create"}
                />
              </div>

              <hr className="divider" />

              <h2 className="card-title">פרטי האירוע</h2>
              <div className="field">
                <label className="field-label" htmlFor="eventType">
                  סוג אירוע
                </label>
                <select id="eventType" className="field-input" name="eventType" value={form.eventType} onChange={onChange}>
                  <option value="חתונה">חתונה</option>
                  <option value="ברית">ברית</option>
                </select>
              </div>
              {form.eventType === "חתונה" ? (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="groomName">
                      שם החתן
                    </label>
                    <input
                      id="groomName"
                      className="field-input"
                      name="groomName"
                      value={form.groomName}
                      onChange={onChange}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="brideName">
                      שם הכלה
                    </label>
                    <input
                      id="brideName"
                      className="field-input"
                      name="brideName"
                      value={form.brideName}
                      onChange={onChange}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="parentName1">
                      שם הורה 1
                    </label>
                    <input
                      id="parentName1"
                      className="field-input"
                      name="parentName1"
                      value={form.parentName1}
                      onChange={onChange}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="parentName2">
                      שם הורה 2
                    </label>
                    <input
                      id="parentName2"
                      className="field-input"
                      name="parentName2"
                      value={form.parentName2}
                      onChange={onChange}
                      required
                    />
                  </div>
                </>
              )}
              <div className="field">
                <label className="field-label" htmlFor="venueName">
                  שם המתחם
                </label>
                <input
                  id="venueName"
                  className="field-input"
                  name="venueName"
                  value={form.venueName}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="city">
                  עיר
                </label>
                <input id="city" className="field-input" name="city" value={form.city} onChange={onChange} required />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="streetAndNumber">
                  רחוב ומספר
                </label>
                <input
                  id="streetAndNumber"
                  className="field-input"
                  name="streetAndNumber"
                  value={form.streetAndNumber}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="eventDate">
                  תאריך
                </label>
                <input
                  id="eventDate"
                  className="field-input"
                  type="date"
                  name="eventDate"
                  value={form.eventDate}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="eventTime">
                  שעה
                </label>
                <input
                  id="eventTime"
                  className="field-input"
                  type="time"
                  name="eventTime"
                  value={form.eventTime}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="eventImage">
                  תמונת אירוע
                </label>
                <input id="eventImage" className="field-input" type="file" accept="image/*" onChange={onImageChange} />
                {form.imageDataUrl ? <img className="event-image-preview" src={form.imageDataUrl} alt="תצוגה מקדימה" /> : null}
              </div>

              <div className="toolbar">
                <button className="btn btn-primary" disabled={loading} type="submit">
                  {loading ? "שומר…" : wizardMode === "edit" ? "שמירת שינויים" : "שמור לקוח"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={closeWizard}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {result ? (
          <div className="card result-links">
            <h2 className="card-title">🎉 יופי, הכול מוכן! 🎉</h2>
            <p>
              <strong>שם משתמש:</strong> {result.credentials.username}
            </p>
            <p>
              <strong>סיסמה:</strong> {result.credentials.password}
            </p>
            <p>
              <strong>דשבורד לקוח:</strong>{" "}
              <a href={clientDashboardUrl} target="_blank" rel="noreferrer">
                {clientDashboardUrl}
              </a>
            </p>
            <p>
              <strong>קישור ציבורי:</strong>{" "}
              <a href={publicEventUrl} target="_blank" rel="noreferrer">
                {publicEventUrl}
              </a>
            </p>
            <div className="share-block">
              <p className="share-title">הודעה מוכנה ללקוח:</p>
              <textarea className="field-input share-textarea" value={finalClientMessage} readOnly />
              <button className="btn btn-primary" type="button" onClick={() => copyClientMessage(finalClientMessage)}>
                {clientMessageCopied ? "הודעה הועתקה" : "העתק הודעה ללקוח"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={copyShareMessage}>
                {copyDone ? "הועתק בהצלחה" : "העתקת הודעה לשליחה"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
