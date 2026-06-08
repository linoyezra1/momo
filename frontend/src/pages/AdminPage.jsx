import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Trash2, X } from "lucide-react";
import api from "../api";
import { buildClientOnboardingMessage } from "../utils/clientOnboardingMessage";
import { formatIsraeliDate } from "../utils/dateFormat";
import "../us/admin-portal.css";

const initialForm = {
  username: "",
  password: "",
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
  if (event.hostNames) return event.hostNames.trim();
  if (event.eventType === "חתונה") {
    return `${event.groomName} & ${event.brideName}`.trim();
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1} ו${event.parentName2}`.trim();
  }
  if (event.eventType === "בת מצווה") {
    return `${event.batMitzvahName || ""}`.trim();
  }
  return "";
}

function isUsClient(client) {
  return client?.market === "us" || Boolean(client?.etsyOrderId || client?.event?.hostNames);
}

function buildClientLabel(client) {
  return (
    buildEventDisplayText(client?.event) ||
    client?.contactEmail ||
    client?.username ||
    "לקוח ללא שם"
  );
}

function buildClientSubline(client) {
  const parts = [];
  if (client?.etsyOrderId) parts.push(`אטסי #${client.etsyOrderId}`);
  if (client?.contactEmail) parts.push(client.contactEmail);
  if (Number(client?.payment?.amountPaid) > 0) {
    parts.push(`₪${Number(client.payment.amountPaid).toLocaleString("he-IL")}`);
  }
  return parts.join(" · ") || client?.username || "";
}

function formatCreatedAt(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("he-IL", {
    dateStyle: "medium",
    timeStyle: "short"
  });
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
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [paymentDraft, setPaymentDraft] = useState({ amountPaid: "", paymentMethod: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [clientQuota, setClientQuota] = useState(null);
  const [clientQuotaLoading, setClientQuotaLoading] = useState(false);
  const [clientQuotaError, setClientQuotaError] = useState("");
  const [clientQuotaSaved, setClientQuotaSaved] = useState(false);
  const [clientQuotaDraft, setClientQuotaDraft] = useState({ code: "", total_credits: "" });
  const publicEventUrl = toAppUrl(result?.publicEventLink);
  const clientDashboardUrl = toAppUrl(result?.clientDashboardLink);
  const eventDisplayText = buildEventDisplayText(createdEvent);
  const selectedClient = useMemo(
    () => clients.find((client) => String(client.userId) === String(selectedClientId)) || null,
    [clients, selectedClientId]
  );
  const shareMessage = createdEvent
    ? `הזמנה לאירוע ${createdEvent.eventType} של ${eventDisplayText}
תאריך: ${formatIsraeliDate(createdEvent.eventDate)} | שעה: ${createdEvent.eventTime}
מיקום: ${createdEvent.venueName}, ${createdEvent.city}, ${createdEvent.streetAndNumber}

נא אשרו הגעה בקישור:
${publicEventUrl}`
    : "";
  const passwordForSelected = useMemo(() => {
    if (!selectedClient) return "";
    if (selectedClient.loginPassword) return selectedClient.loginPassword;
    if (result?.credentials?.password && String(result.userId) === String(selectedClient.userId)) {
      return result.credentials.password;
    }
    return "";
  }, [result, selectedClient]);

  const totalRevenueFromClients = useMemo(
    () => clients.reduce((sum, client) => sum + (Number(client.payment?.amountPaid) || 0), 0),
    [clients]
  );

  const clientMessageForSelected = useMemo(() => {
    if (!selectedClient) return "";
    return buildClientOnboardingMessage({
      username: selectedClient.username,
      password: passwordForSelected,
      publicEventUrl: toAppUrl(selectedClient.publicEventLink),
      clientDashboardUrl: toAppUrl(selectedClient.clientDashboardLink)
    });
  }, [selectedClient, passwordForSelected]);

  const finalClientMessage =
    result && createdEvent
      ? buildClientOnboardingMessage({
          username: result.credentials?.username || form.username,
          password: result.credentials?.password || "",
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
      setTotalRevenue(Number(response.data.totalRevenue) || 0);
      if (!selectedClientId && response.data.clients?.length) {
        setSelectedClientId(response.data.clients[0].userId);
      }
    } catch (loadError) {
      setClientsError(loadError.response?.data?.message || "טעינת לקוחות נכשלה");
    } finally {
      setLoadingClients(false);
    }
  };

  const loadClientQuota = async (userId) => {
    if (!userId) {
      setClientQuota(null);
      return;
    }
    setClientQuotaLoading(true);
    setClientQuotaError("");
    try {
      const response = await api.get(`/admin/clients/${userId}/whatsapp-quota`);
      const quota = response.data?.quota || null;
      setClientQuota(quota);
      setClientQuotaDraft({
        code: quota?.code || "",
        total_credits: quota?.total_credits ? String(quota.total_credits) : ""
      });
    } catch (loadError) {
      setClientQuota(null);
      setClientQuotaError(loadError.response?.data?.message || "טעינת מכסת וואטסאפ נכשלה");
    } finally {
      setClientQuotaLoading(false);
    }
  };

  const assignClientQuota = async (event) => {
    event.preventDefault();
    if (!selectedClientId) return;
    setClientQuotaLoading(true);
    setClientQuotaError("");
    setClientQuotaSaved(false);
    try {
      const response = await api.post(`/admin/clients/${selectedClientId}/whatsapp-quota`, {
        code: clientQuotaDraft.code.trim(),
        total_credits: Number(clientQuotaDraft.total_credits)
      });
      const quota = response.data?.quota || null;
      setClientQuota(quota);
      setClientQuotaDraft({
        code: quota?.code || "",
        total_credits: quota?.total_credits ? String(quota.total_credits) : ""
      });
      setClientQuotaSaved(true);
      window.setTimeout(() => setClientQuotaSaved(false), 2500);
    } catch (assignError) {
      setClientQuotaError(assignError.response?.data?.message || "הקצאת מכסה נכשלה");
    } finally {
      setClientQuotaLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadClientQuota(selectedClientId);
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClient) {
      setPaymentDraft({ amountPaid: "", paymentMethod: "" });
      return;
    }
    const amount = selectedClient.payment?.amountPaid;
    setPaymentDraft({
      amountPaid: amount === 0 || amount == null ? "" : String(amount),
      paymentMethod: selectedClient.payment?.paymentMethod || ""
    });
    setPaymentSaved(false);
  }, [selectedClient]);

  const onPaymentChange = (event) => {
    const { name, value } = event.target;
    setPaymentDraft((prev) => ({ ...prev, [name]: value }));
    setPaymentSaved(false);
  };

  const savePayment = async () => {
    if (!selectedClientId) return;
    setPaymentSaving(true);
    setError("");
    try {
      const amountPaid =
        paymentDraft.amountPaid === "" || paymentDraft.amountPaid == null
          ? 0
          : Math.max(0, Number(paymentDraft.amountPaid));
      await api.patch(`/admin/clients/${selectedClientId}/payment`, {
        amountPaid,
        paymentMethod: paymentDraft.paymentMethod.trim()
      });
      await loadClients();
      setPaymentSaved(true);
      window.setTimeout(() => setPaymentSaved(false), 2000);
    } catch (paymentErr) {
      setError(paymentErr.response?.data?.message || "שמירת פרטי התשלום נכשלה");
    } finally {
      setPaymentSaving(false);
    }
  };

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

    if (!form.username.trim()) {
      setError("יש למלא שם משתמש");
      return;
    }
    if (wizardMode === "create" && !form.password.trim()) {
      setError("יש למלא סיסמה");
      return;
    }
    if (form.eventType === "חתונה" && (!form.groomName.trim() || !form.brideName.trim())) {
      setError("יש למלא שם חתן ושם כלה");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: form.username,
        event: {
          eventType: form.eventType,
          groomName: form.eventType === "חתונה" ? form.groomName : "",
          brideName: form.eventType === "חתונה" ? form.brideName : "",
          batMitzvahName: form.eventType === "בת מצווה" ? form.batMitzvahName : "",
          parentName1: form.eventType === "ברית" || form.eventType === "בת מצווה" ? form.parentName1 : "",
          parentName2: form.eventType === "ברית" || form.eventType === "בת מצווה" ? form.parentName2 : "",
          venueName: form.venueName,
          city: form.city,
          streetAndNumber: form.streetAndNumber,
          eventDate: form.eventDate,
          eventDateHebrew: form.eventType === "ברית" ? form.eventDateHebrew : "",
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
      batMitzvahName: client.event?.batMitzvahName || "",
      parentName1: client.event?.parentName1 || "",
      parentName2: client.event?.parentName2 || "",
      venueName: client.event?.venueName || "",
      city: client.event?.city || "",
      streetAndNumber: client.event?.streetAndNumber || "",
      eventDate: client.event?.eventDate || "",
      eventDateHebrew: client.event?.eventDateHebrew || "",
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

  const copyFieldValue = async (fieldKey, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldKey);
      window.setTimeout(() => setCopiedField(""), 1800);
    } catch {
      setError("לא הצלחנו להעתיק");
    }
  };

  const selectedPublicUrl = selectedClient ? toAppUrl(selectedClient.publicEventLink) : "";
  const selectedDashboardUrl = selectedClient ? toAppUrl(selectedClient.clientDashboardLink) : "";

  return (
    <div className="us-admin-portal us-admin-shell" dir="rtl">
      <div className="us-admin-container">
        <header className="us-admin-header">
          <h1>מרכז ניהול אירועים</h1>
          <p>ניהול לקוחות, פרטי הזמנה וקישורים לדשבורד</p>
        </header>

        <div className="us-admin-toolbar">
          <button className="us-admin-btn us-admin-btn--primary" type="button" onClick={openCreateWizard}>
            לקוח חדש
          </button>
        </div>

        {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}

        <div className="us-admin-stats">
          <div className="us-admin-stat-card">
            <h3>סה״כ הכנסות</h3>
            <p>₪{(totalRevenue || totalRevenueFromClients).toLocaleString("he-IL")}</p>
          </div>
          <div className="us-admin-stat-card">
            <h3>לקוחות פעילים</h3>
            <p>{clients.length}</p>
          </div>
        </div>

        <section className="us-admin-layout">
          <div className="us-admin-card">
            <h2 className="us-admin-card-title">לקוחות פעילים</h2>
            <div className="us-admin-card-body">
              {loadingClients ? <p className="us-admin-empty">טוען רשימה…</p> : null}
              {clientsError ? <p className="us-admin-message us-admin-message--error">{clientsError}</p> : null}
              {!loadingClients && !clients.length ? <p className="us-admin-empty">אין לקוחות להצגה</p> : null}
              <div className="us-admin-client-list">
                {clients.map((client) => (
                  <div
                    key={client.userId}
                    className={`us-admin-client-row ${String(selectedClientId) === String(client.userId) ? "is-active" : ""}`}
                  >
                    <button className="us-admin-client-main" type="button" onClick={() => setSelectedClientId(client.userId)}>
                      <strong>{buildClientLabel(client)}</strong>
                      <span>{buildClientSubline(client)}</span>
                    </button>
                    {!isUsClient(client) ? (
                      <button
                        className="us-admin-btn us-admin-btn--xs"
                        type="button"
                        onClick={() => openEditWizard(client)}
                        aria-label="עריכת לקוח"
                      >
                        <Pencil size={14} />
                      </button>
                    ) : null}
                    <button
                      className="us-admin-btn us-admin-btn--xs us-admin-btn--danger"
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
          </div>

          <div className="us-admin-card">
            <h2 className="us-admin-card-title">פרטי לקוח</h2>
            <div className="us-admin-card-body">
              {!selectedClient ? (
                <p className="us-admin-empty">בחרו לקוח מהרשימה להצגת פרטים</p>
              ) : (
                <>
                  {buildEventDisplayText(selectedClient.event) ? (
                    <p className="us-admin-event-summary">
                      <strong>אירוע:</strong> {buildEventDisplayText(selectedClient.event)}
                      {selectedClient.event?.eventDate ? (
                        <>
                          {" "}
                          · <strong>תאריך:</strong> {formatIsraeliDate(selectedClient.event.eventDate)}
                        </>
                      ) : null}
                      {selectedClient.event?.venueName ? (
                        <>
                          {" "}
                          · <strong>מיקום:</strong> {selectedClient.event.venueName}
                        </>
                      ) : null}
                    </p>
                  ) : null}

                  <div className="us-admin-detail-grid">
                    <div className="us-admin-detail-item">
                      <span className="us-admin-detail-label">מספר הזמנה באטסי</span>
                      <div className="us-admin-link-row">
                        <span className="us-admin-detail-value us-admin-detail-value--mono">
                          {selectedClient.etsyOrderId || "—"}
                        </span>
                        {selectedClient.etsyOrderId ? (
                          <button
                            className="us-admin-btn us-admin-btn--xs"
                            type="button"
                            onClick={() => copyFieldValue("etsy", selectedClient.etsyOrderId)}
                            aria-label="העתקת מספר הזמנה"
                          >
                            <Copy size={14} />
                            {copiedField === "etsy" ? "הועתק" : ""}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="us-admin-detail-item">
                      <span className="us-admin-detail-label">כתובת מייל</span>
                      <div className="us-admin-link-row">
                        <span className="us-admin-detail-value">{selectedClient.contactEmail || "—"}</span>
                        {selectedClient.contactEmail ? (
                          <button
                            className="us-admin-btn us-admin-btn--xs"
                            type="button"
                            onClick={() => copyFieldValue("email", selectedClient.contactEmail)}
                            aria-label="העתקת מייל"
                          >
                            <Copy size={14} />
                            {copiedField === "email" ? "הועתק" : ""}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="us-admin-detail-item">
                      <span className="us-admin-detail-label">תאריך יצירה</span>
                      <span className="us-admin-detail-value">{formatCreatedAt(selectedClient.createdAt)}</span>
                    </div>

                    <div className="us-admin-detail-item">
                      <span className="us-admin-detail-label">שם משתמש</span>
                      <div className="us-admin-link-row">
                        <span className="us-admin-detail-value us-admin-detail-value--mono">{selectedClient.username}</span>
                        <button
                          className="us-admin-btn us-admin-btn--xs"
                          type="button"
                          onClick={() => copyFieldValue("username", selectedClient.username)}
                          aria-label="העתקת שם משתמש"
                        >
                          <Copy size={14} />
                          {copiedField === "username" ? "הועתק" : ""}
                        </button>
                      </div>
                    </div>

                    <div className="us-admin-detail-item">
                      <span className="us-admin-detail-label">סיסמה</span>
                      <div className="us-admin-link-row">
                        <span className="us-admin-detail-value us-admin-detail-value--mono">
                          {passwordForSelected || "—"}
                        </span>
                        {passwordForSelected ? (
                          <button
                            className="us-admin-btn us-admin-btn--xs"
                            type="button"
                            onClick={() => copyFieldValue("password", passwordForSelected)}
                            aria-label="העתקת סיסמה"
                          >
                            <Copy size={14} />
                            {copiedField === "password" ? "הועתק" : ""}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="us-admin-detail-item us-admin-detail-item--wide">
                      <span className="us-admin-detail-label">קישור הזמנה</span>
                      <div className="us-admin-link-row">
                        <a href={selectedPublicUrl} target="_blank" rel="noreferrer">
                          {selectedPublicUrl}
                        </a>
                        <button
                          className="us-admin-btn us-admin-btn--xs"
                          type="button"
                          onClick={() => copyFieldValue("public", selectedPublicUrl)}
                          aria-label="העתקת קישור הזמנה"
                        >
                          <Copy size={14} />
                          {copiedField === "public" ? "הועתק" : ""}
                        </button>
                      </div>
                    </div>

                    <div className="us-admin-detail-item us-admin-detail-item--wide">
                      <span className="us-admin-detail-label">קישור דשבורד</span>
                      <div className="us-admin-link-row">
                        <a href={selectedDashboardUrl} target="_blank" rel="noreferrer">
                          {selectedDashboardUrl}
                        </a>
                        <button
                          className="us-admin-btn us-admin-btn--xs"
                          type="button"
                          onClick={() => copyFieldValue("dashboard", selectedDashboardUrl)}
                          aria-label="העתקת קישור דשבורד"
                        >
                          <Copy size={14} />
                          {copiedField === "dashboard" ? "הועתק" : ""}
                        </button>
                      </div>
                    </div>
                  </div>

                  {!isUsClient(selectedClient) && selectedClient.event?.imageDataUrl ? (
                    <img
                      className="us-admin-event-image"
                      src={selectedClient.event.imageDataUrl}
                      alt="תמונת קאבר"
                    />
                  ) : null}

                  <div className="us-admin-payment-block us-admin-whatsapp-quota-block">
                    <h3>מכסת וואטסאפ ללקוח (Twilio)</h3>
                    <p className="us-admin-field-hint">
                      הקצו קוד ומכסת הודעות ללקוח הנבחר. הקוד יופיע אוטומטית בדשבורד שלו לתפוצה רחבה.
                    </p>
                    {clientQuotaLoading ? <p className="us-admin-empty">טוען מכסה…</p> : null}
                    {clientQuota ? (
                      <p className="us-admin-quota-status">
                        <strong>קוד פעיל:</strong> {clientQuota.code} · נותרו{" "}
                        <strong>{clientQuota.remaining_credits}</strong> / {clientQuota.total_credits} הודעות
                      </p>
                    ) : (
                      <p className="us-admin-field-hint">ללקוח זה עדיין לא הוקצתה מכסת וואטסאפ.</p>
                    )}
                    {clientQuotaError ? (
                      <p className="us-admin-message us-admin-message--error">{clientQuotaError}</p>
                    ) : null}
                    <form className="us-admin-payment-fields" onSubmit={assignClientQuota}>
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="client-quota-code">
                          קוד (אופציונלי — ייווצר אוטומטית)
                        </label>
                        <input
                          id="client-quota-code"
                          className="us-admin-field-input"
                          value={clientQuotaDraft.code}
                          onChange={(event) =>
                            setClientQuotaDraft((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                          }
                          placeholder="למשל: MOMO-450"
                        />
                      </div>
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="client-quota-credits">
                          מכסת הודעות
                        </label>
                        <input
                          id="client-quota-credits"
                          className="us-admin-field-input"
                          type="number"
                          min="1"
                          value={clientQuotaDraft.total_credits}
                          onChange={(event) =>
                            setClientQuotaDraft((prev) => ({ ...prev, total_credits: event.target.value }))
                          }
                          placeholder="למשל: 450"
                          required
                        />
                      </div>
                      <button className="us-admin-btn us-admin-btn--primary" type="submit" disabled={clientQuotaLoading}>
                        {clientQuotaLoading ? "שומר…" : clientQuotaSaved ? "הוקצה בהצלחה" : clientQuota ? "עדכון מכסה" : "הקצאת מכסה ללקוח"}
                      </button>
                    </form>
                  </div>

                  <div className="us-admin-payment-block">
                    <h3>פרטי תשלום (אופציונלי)</h3>
                    <p className="us-admin-field-hint">ניתן להשאיר ריק או 0 אם הלקוח טרם שילם.</p>
                    <div className="us-admin-payment-fields">
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="payment-amount">
                          כמה שולם (₪)
                        </label>
                        <input
                          id="payment-amount"
                          className="us-admin-field-input"
                          name="amountPaid"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={paymentDraft.amountPaid}
                          onChange={onPaymentChange}
                        />
                      </div>
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="payment-method">
                          איך שולם?
                        </label>
                        <input
                          id="payment-method"
                          className="us-admin-field-input"
                          name="paymentMethod"
                          type="text"
                          placeholder="לדוגמה: מזומן, העברה, ביט…"
                          value={paymentDraft.paymentMethod}
                          onChange={onPaymentChange}
                        />
                      </div>
                    </div>
                    <button
                      className="us-admin-btn"
                      type="button"
                      disabled={paymentSaving}
                      onClick={savePayment}
                    >
                      {paymentSaving ? "שומר…" : paymentSaved ? "נשמר" : "שמירת תשלום"}
                    </button>
                  </div>

                  <div className="us-admin-share-block">
                    <p className="us-admin-share-title">הודעה מוכנה ללקוח (להעתקה לוואטסאפ):</p>
                    <textarea className="us-admin-share-textarea" value={clientMessageForSelected} readOnly />
                    <button
                      className="us-admin-btn us-admin-btn--primary"
                      type="button"
                      onClick={() => copyClientMessage(clientMessageForSelected)}
                    >
                      {clientMessageCopied ? "הודעה הועתקה" : "העתק הודעה ללקוח"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {showCreateWizard ? (
          <div className="us-admin-modal-backdrop" role="presentation">
            <form className="us-admin-modal" onSubmit={onSubmit}>
              <div className="us-admin-modal-header">
                <h2 className="us-admin-card-title" style={{ border: "none", padding: 0, background: "transparent" }}>
                  {wizardMode === "edit" ? "עריכת לקוח" : "אשף יצירת לקוח חדש"}
                </h2>
                <button className="us-admin-modal-close" type="button" onClick={closeWizard} aria-label="סגירה">
                  <X size={18} />
                </button>
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="username">
                  שם משתמש <span className="us-admin-required">*</span>
                </label>
                <input
                  id="username"
                  className="us-admin-field-input"
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="password">
                  סיסמה {wizardMode === "create" ? <span className="us-admin-required">*</span> : null}{" "}
                  {wizardMode === "edit" ? "(השאירו ריק לשמירת הסיסמה הקיימת)" : ""}
                </label>
                <input
                  id="password"
                  className="us-admin-field-input"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  required={wizardMode === "create"}
                />
              </div>

              <hr className="us-admin-divider" />

              <h2 className="us-admin-card-title" style={{ border: "none", padding: "0 0 0.5rem", background: "transparent" }}>
                פרטי האירוע
              </h2>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="eventType">
                  סוג אירוע
                </label>
                <select id="eventType" className="us-admin-field-input" name="eventType" value={form.eventType} onChange={onChange}>
                  <option value="חתונה">חתונה</option>
                  <option value="ברית">ברית</option>
                  <option value="בת מצווה">בת מצווה</option>
                </select>
              </div>
              {form.eventType === "חתונה" ? (
                <>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="groomName">
                      שם החתן <span className="us-admin-required">*</span>
                    </label>
                    <input
                      id="groomName"
                      className="us-admin-field-input"
                      name="groomName"
                      value={form.groomName}
                      onChange={onChange}
                      required
                    />
                  </div>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="brideName">
                      שם הכלה <span className="us-admin-required">*</span>
                    </label>
                    <input
                      id="brideName"
                      className="us-admin-field-input"
                      name="brideName"
                      value={form.brideName}
                      onChange={onChange}
                      required
                    />
                  </div>
                </>
              ) : form.eventType === "ברית" ? (
                <>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="parentName1">
                      שם הורה 1
                    </label>
                    <input
                      id="parentName1"
                      className="us-admin-field-input"
                      name="parentName1"
                      value={form.parentName1}
                      onChange={onChange}
                    />
                  </div>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="parentName2">
                      שם הורה 2
                    </label>
                    <input
                      id="parentName2"
                      className="us-admin-field-input"
                      name="parentName2"
                      value={form.parentName2}
                      onChange={onChange}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="batMitzvahName">
                      שם כלת המצווה
                    </label>
                    <input
                      id="batMitzvahName"
                      className="us-admin-field-input"
                      name="batMitzvahName"
                      value={form.batMitzvahName}
                      onChange={onChange}
                    />
                  </div>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="parentName1">
                      שם הורה 1
                    </label>
                    <input
                      id="parentName1"
                      className="us-admin-field-input"
                      name="parentName1"
                      value={form.parentName1}
                      onChange={onChange}
                    />
                  </div>
                  <div className="us-admin-field">
                    <label className="us-admin-field-label" htmlFor="parentName2">
                      שם הורה 2 (אופציונלי)
                    </label>
                    <input
                      id="parentName2"
                      className="us-admin-field-input"
                      name="parentName2"
                      value={form.parentName2}
                      onChange={onChange}
                      placeholder="אופציונלי"
                    />
                  </div>
                </>
              )}
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="venueName">
                  שם המתחם
                </label>
                <input
                  id="venueName"
                  className="us-admin-field-input"
                  name="venueName"
                  value={form.venueName}
                  onChange={onChange}
                />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="city">
                  עיר
                </label>
                <input id="city" className="us-admin-field-input" name="city" value={form.city} onChange={onChange} />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="streetAndNumber">
                  רחוב ומספר
                </label>
                <input
                  id="streetAndNumber"
                  className="us-admin-field-input"
                  name="streetAndNumber"
                  value={form.streetAndNumber}
                  onChange={onChange}
                />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="eventDate">
                  תאריך
                </label>
                <input
                  id="eventDate"
                  className="us-admin-field-input"
                  type="date"
                  name="eventDate"
                  value={form.eventDate}
                  onChange={onChange}
                />
              </div>
              {form.eventType === "ברית" ? (
                <div className="us-admin-field">
                  <label className="us-admin-field-label" htmlFor="eventDateHebrew">
                    תאריך עברי (אופציונלי)
                  </label>
                  <input
                    id="eventDateHebrew"
                    className="us-admin-field-input"
                    name="eventDateHebrew"
                    placeholder='למשל: כ״ג באייר תשפ״ו'
                    value={form.eventDateHebrew}
                    onChange={onChange}
                  />
                  <p className="us-admin-field-hint">מוצג בדף ההזמנה לברית ליד יום השבוע. אם ריק — לא יוצג.</p>
                </div>
              ) : null}
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="eventTime">
                  שעה
                </label>
                <input
                  id="eventTime"
                  className="us-admin-field-input"
                  type="time"
                  name="eventTime"
                  value={form.eventTime}
                  onChange={onChange}
                />
              </div>
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="eventImage">
                  תמונת אירוע
                </label>
                <input id="eventImage" className="us-admin-field-input" type="file" accept="image/*" onChange={onImageChange} />
                {form.imageDataUrl ? <img className="us-admin-event-image" src={form.imageDataUrl} alt="תצוגה מקדימה" /> : null}
              </div>

              <div className="us-admin-form-actions">
                <button className="us-admin-btn us-admin-btn--primary" disabled={loading} type="submit">
                  {loading ? "שומר…" : wizardMode === "edit" ? "שמירת שינויים" : "שמור לקוח"}
                </button>
                <button className="us-admin-btn" type="button" onClick={closeWizard}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {result ? (
          <div className="us-admin-card us-admin-result-card">
            <h2 className="us-admin-card-title">🎉 יופי, הכול מוכן! 🎉</h2>
            <div className="us-admin-card-body">
              <div className="us-admin-detail-grid">
                <div className="us-admin-detail-item">
                  <span className="us-admin-detail-label">שם משתמש</span>
                  <span className="us-admin-detail-value">{result.credentials.username}</span>
                </div>
                <div className="us-admin-detail-item">
                  <span className="us-admin-detail-label">סיסמה</span>
                  <span className="us-admin-detail-value us-admin-detail-value--mono">{result.credentials.password}</span>
                </div>
                <div className="us-admin-detail-item us-admin-detail-item--wide">
                  <span className="us-admin-detail-label">קישור דשבורד</span>
                  <a href={clientDashboardUrl} target="_blank" rel="noreferrer">
                    {clientDashboardUrl}
                  </a>
                </div>
                <div className="us-admin-detail-item us-admin-detail-item--wide">
                  <span className="us-admin-detail-label">קישור הזמנה</span>
                  <a href={publicEventUrl} target="_blank" rel="noreferrer">
                    {publicEventUrl}
                  </a>
                </div>
              </div>
              <div className="us-admin-share-block" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                <p className="us-admin-share-title">הודעה מוכנה ללקוח:</p>
                <textarea className="us-admin-share-textarea" value={finalClientMessage} readOnly />
                <div className="us-admin-form-actions">
                  <button className="us-admin-btn us-admin-btn--primary" type="button" onClick={() => copyClientMessage(finalClientMessage)}>
                    {clientMessageCopied ? "הודעה הועתקה" : "העתק הודעה ללקוח"}
                  </button>
                  <button className="us-admin-btn" type="button" onClick={copyShareMessage}>
                    {copyDone ? "הועתק בהצלחה" : "העתקת הודעה לשליחה"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
