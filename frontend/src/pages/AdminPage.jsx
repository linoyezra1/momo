import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Pencil, Trash2, X } from "lucide-react";
import api from "../api";
import { clearAdminToken } from "../utils/adminAuth";
import { buildClientOnboardingMessage } from "../utils/clientOnboardingMessage";
import { formatIsraeliDate } from "../utils/dateFormat";
import "../us/admin-portal.css";

const PACKAGE_TYPE_OPTIONS = [
  { value: "custom", label: "התאמה אישית" },
  { value: "digital", label: "דיגיטל" },
  { value: "vip_2_rounds", label: "VIP — 2 סבבים" },
  { value: "vip_4_rounds", label: "VIP — 4 סבבים" }
];

const DEAL_PAYMENT_METHOD_OPTIONS = [
  { value: "bit", label: "ביט" },
  { value: "paybox", label: "פייבוקס" },
  { value: "bank_transfer", label: "העברה בנקאית" },
  { value: "cash", label: "מזומן" },
  { value: "other", label: "אחר" }
];

const FEATURE_CHECKBOXES = [
  { key: "whatsappRound1", label: "וואטסאפ — סבב 1" },
  { key: "whatsappRound2", label: "וואטסאפ — סבב 2" },
  { key: "phoneCallsRound1", label: "שיחות טלפון — סבב 1" },
  { key: "phoneCallsRound2", label: "שיחות טלפון — סבב 2" },
  { key: "phoneCallsRound3", label: "שיחות טלפון — סבב 3" },
  { key: "phoneCallsRound4", label: "שיחות טלפון — סבב 4" },
  { key: "eventDayReminder", label: "תזכורת ביום האירוע" },
  { key: "eventDayTableNumber", label: "שליחת מספר שולחן ביום האירוע" },
  { key: "thankYouMessage", label: "הודעת תודה" }
];

function defaultDealDraft() {
  return {
    packageType: "custom",
    includedFeatures: {
      whatsappRound1: true,
      whatsappRound2: false,
      phoneCallsRound1: false,
      phoneCallsRound2: false,
      phoneCallsRound3: false,
      phoneCallsRound4: false,
      eventDayReminder: true,
      eventDayTableNumber: true,
      thankYouMessage: true
    },
    marketingSource: "",
    paymentAmount: "",
    paymentMethod: "other",
    adminNotes: ""
  };
}

function dealDraftFromClient(client) {
  const deal = client?.deal || {};
  const features = { ...defaultDealDraft().includedFeatures, ...(deal.includedFeatures || {}) };
  const amount =
    deal.paymentAmount != null && deal.paymentAmount !== ""
      ? deal.paymentAmount
      : client?.payment?.amountPaid;
  return {
    packageType: deal.packageType || "custom",
    includedFeatures: features,
    marketingSource: deal.marketingSource || "",
    paymentAmount: amount === 0 || amount == null ? "" : String(amount),
    paymentMethod: deal.paymentMethod || "other",
    adminNotes: deal.adminNotes || ""
  };
}

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
  if (Number(client?.deal?.paymentAmount) > 0) {
    parts.push(`₪${Number(client.deal.paymentAmount).toLocaleString("he-IL")}`);
  } else if (Number(client?.payment?.amountPaid) > 0) {
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
  const navigate = useNavigate();
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
  const [dealDraft, setDealDraft] = useState(defaultDealDraft);
  const [dealSaving, setDealSaving] = useState(false);
  const [dealSaved, setDealSaved] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [clientQuota, setClientQuota] = useState(null);
  const [clientQuotas, setClientQuotas] = useState([]);
  const [clientQuotaLoading, setClientQuotaLoading] = useState(false);
  const [clientQuotaError, setClientQuotaError] = useState("");
  const [clientQuotaSaved, setClientQuotaSaved] = useState(false);
  const [clientQuotaDraft, setClientQuotaDraft] = useState({ code: "", total_credits: "" });
  const [clientQuotaMessage, setClientQuotaMessage] = useState("");
  const [welcomeNotice, setWelcomeNotice] = useState("");
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState("");
  const [leadsNewCount, setLeadsNewCount] = useState(0);
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
    () =>
      clients.reduce((sum, client) => {
        const fromDeal = Number(client.deal?.paymentAmount);
        const fromPayment = Number(client.payment?.amountPaid) || 0;
        return sum + (Number.isFinite(fromDeal) && fromDeal > 0 ? fromDeal : fromPayment);
      }, 0),
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

  const loadLeads = async () => {
    setLeadsLoading(true);
    setLeadsError("");
    try {
      const response = await api.get("/admin/leads");
      setLeads(response.data?.leads || []);
      setLeadsNewCount(Number(response.data?.newCount) || 0);
    } catch (loadError) {
      setLeadsError(loadError.response?.data?.message || "טעינת פניות נכשלה");
    } finally {
      setLeadsLoading(false);
    }
  };

  const updateLeadStatus = async (leadId, status) => {
    try {
      const response = await api.patch(`/admin/leads/${leadId}`, { status });
      const updated = response.data?.lead;
      if (!updated) return;
      setLeads((prev) => {
        const next = prev.map((lead) =>
          String(lead.id) === String(updated.id) ? { ...lead, ...updated } : lead
        );
        setLeadsNewCount(next.filter((lead) => lead.status === "new").length);
        return next;
      });
    } catch (updateError) {
      setLeadsError(updateError.response?.data?.message || "עדכון סטטוס נכשל");
    }
  };

  const loadClientQuota = async (userId) => {
    if (!userId) {
      setClientQuota(null);
      setClientQuotas([]);
      return;
    }
    setClientQuotaLoading(true);
    setClientQuotaError("");
    try {
      const response = await api.get(`/admin/clients/${userId}/whatsapp-quota`);
      const quota = response.data?.quota || null;
      const quotas = response.data?.quotas || response.data?.history || [];
      setClientQuota(quota);
      setClientQuotas(Array.isArray(quotas) ? quotas : []);
      setClientQuotaDraft({
        code: "",
        total_credits: ""
      });
    } catch (loadError) {
      setClientQuota(null);
      setClientQuotas([]);
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
    setClientQuotaMessage("");
    try {
      const response = await api.post(`/admin/clients/${selectedClientId}/whatsapp-quota`, {
        code: clientQuotaDraft.code.trim(),
        total_credits: Number(clientQuotaDraft.total_credits)
      });
      const quota = response.data?.quota || null;
      const quotas = response.data?.quotas || response.data?.history || [];
      setClientQuota(quota);
      setClientQuotas(Array.isArray(quotas) ? quotas : []);
      setClientQuotaDraft({
        code: "",
        total_credits: ""
      });
      setClientQuotaMessage(response.data?.message || "קופון חדש נוצר");
      setClientQuotaSaved(true);
      window.setTimeout(() => {
        setClientQuotaSaved(false);
        setClientQuotaMessage("");
      }, 3500);
    } catch (assignError) {
      setClientQuotaError(assignError.response?.data?.message || "הקצאת מכסה נכשלה");
    } finally {
      setClientQuotaLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    loadLeads();
  }, []);

  useEffect(() => {
    loadClientQuota(selectedClientId);
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClient) {
      setDealDraft(defaultDealDraft());
      return;
    }
    setDealDraft(dealDraftFromClient(selectedClient));
    setDealSaved(false);
  }, [selectedClient]);

  const onDealFieldChange = (event) => {
    const { name, value } = event.target;
    setDealDraft((prev) => ({ ...prev, [name]: value }));
    setDealSaved(false);
  };

  const onDealFeatureToggle = (key) => {
    setDealDraft((prev) => ({
      ...prev,
      includedFeatures: {
        ...prev.includedFeatures,
        [key]: !prev.includedFeatures?.[key]
      }
    }));
    setDealSaved(false);
  };

  const saveDeal = async () => {
    if (!selectedClientId) return;
    setDealSaving(true);
    setError("");
    try {
      const payload = {
        packageType: dealDraft.packageType || "custom",
        includedFeatures: dealDraft.includedFeatures,
        marketingSource: dealDraft.marketingSource.trim(),
        paymentAmount:
          dealDraft.paymentAmount === "" || dealDraft.paymentAmount == null
            ? 0
            : Math.max(0, Number(dealDraft.paymentAmount)),
        paymentMethod: dealDraft.paymentMethod || "other",
        adminNotes: dealDraft.adminNotes.trim()
      };
      const response = await api.patch(`/admin/clients/${selectedClientId}/deal`, payload);
      await loadClients();
      if (response.data?.deal) {
        setDealDraft(dealDraftFromClient({ deal: response.data.deal, payment: response.data.payment }));
      }
      setDealSaved(true);
      window.setTimeout(() => setDealSaved(false), 2000);
    } catch (dealErr) {
      setError(dealErr.response?.data?.message || "שמירת פרטי העסקה נכשלה");
    } finally {
      setDealSaving(false);
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
    if (wizardMode === "create" && !form.contactPhone.trim()) {
      setError("יש להזין מספר טלפון של הכלה (איש קשר)");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: form.username,
        contactPhone: form.contactPhone,
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
      if (wizardMode === "create") {
        if (response.data?.welcomeWhatsApp?.sent) {
          setWelcomeNotice("הודעת וואטסאפ עם פרטי הגישה נשלחה לכלה");
        } else if (response.data?.welcomeWhatsApp?.reason === "twilio_not_configured") {
          setWelcomeNotice("החשבון נוצר, אך Twilio לא מוגדר — הודעת הוואטסאפ לא נשלחה");
        } else if (response.data?.welcomeWhatsApp?.reason === "invalid_phone") {
          setWelcomeNotice("החשבון נוצר, אך מספר הטלפון לא תקין לשליחת וואטסאפ");
        } else {
          setWelcomeNotice("החשבון נוצר, אך שליחת הודעת הוואטסאפ נכשלה");
        }
      } else {
        setWelcomeNotice("");
      }
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
      contactPhone: client.contactPhone || "",
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

  const logoutAdmin = () => {
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  };

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
          <button className="us-admin-btn" type="button" onClick={logoutAdmin}>
            התנתקות
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
          <div className="us-admin-stat-card">
            <h3>פניות חדשות</h3>
            <p>{leadsNewCount}</p>
          </div>
        </div>

        <section className="us-admin-card" style={{ marginBottom: "1.25rem" }}>
          <div className="us-admin-toolbar" style={{ marginBottom: "0.75rem" }}>
            <h2 className="us-admin-card-title" style={{ margin: 0 }}>
              פניות מדף הנחיתה
            </h2>
            <button className="us-admin-btn" type="button" onClick={loadLeads} disabled={leadsLoading}>
              {leadsLoading ? "מרענן…" : "רענון"}
            </button>
          </div>
          <div className="us-admin-card-body">
            {leadsError ? <p className="us-admin-message us-admin-message--error">{leadsError}</p> : null}
            {leadsLoading && !leads.length ? <p className="us-admin-empty">טוען פניות…</p> : null}
            {!leadsLoading && !leads.length ? <p className="us-admin-empty">אין פניות עדיין</p> : null}
            {leads.length ? (
              <div className="us-admin-leads-list">
                {leads.map((lead) => (
                  <article key={lead.id} className="us-admin-lead-card">
                    <div className="us-admin-lead-head">
                      <strong>{lead.fullName}</strong>
                      <span dir="ltr">{lead.phone}</span>
                    </div>
                    <div className="us-admin-lead-meta">
                      <span>
                        התקבל:{" "}
                        {lead.createdAt
                          ? new Date(lead.createdAt).toLocaleString("he-IL")
                          : "—"}
                      </span>
                      <span>תאריך אירוע: {lead.eventDate || "לא צוין"}</span>
                    </div>
                    {lead.message ? <p className="us-admin-lead-message">{lead.message}</p> : null}
                    <div className="us-admin-lead-actions">
                      <label>
                        סטטוס
                        <select
                          value={lead.status || "new"}
                          onChange={(event) => updateLeadStatus(lead.id, event.target.value)}
                        >
                          <option value="new">חדש</option>
                          <option value="contacted">טופל</option>
                          <option value="closed">נסגר</option>
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

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
                      אפשר להקצות ללקוח כמה קופונים שונים במקביל (למשל קוד X עם 100 הודעות וקוד Y עם 50).
                      כל הקצאה יוצרת קופון חדש — בלי לדרוס קופונים קיימים.
                    </p>
                    {clientQuotaLoading ? <p className="us-admin-empty">טוען מכסה…</p> : null}
                    {clientQuotas.length ? (
                      <ul className="us-admin-coupon-list">
                        {clientQuotas.map((item) => (
                          <li key={item.codeId || item.code} className={!item.isActive ? "is-inactive" : ""}>
                            <strong>{item.code}</strong>
                            {" · "}
                            נותרו <strong>{item.remaining_credits}</strong> / {item.total_credits}
                            {!item.isActive ? " · לא פעיל" : item.remaining_credits <= 0 ? " · מוצה" : " · פעיל"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="us-admin-field-hint">ללקוח זה עדיין אין קופונים.</p>
                    )}
                    {clientQuotaMessage ? <p className="us-admin-message">{clientQuotaMessage}</p> : null}
                    {clientQuotaError ? (
                      <p className="us-admin-message us-admin-message--error">{clientQuotaError}</p>
                    ) : null}
                    <form className="us-admin-payment-fields" onSubmit={assignClientQuota}>
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="client-quota-code">
                          שם קוד חדש (חובה שיהיה שונה מקופונים קיימים)
                        </label>
                        <input
                          id="client-quota-code"
                          className="us-admin-field-input"
                          value={clientQuotaDraft.code}
                          onChange={(event) =>
                            setClientQuotaDraft((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                          }
                          placeholder="למשל: MOMO-Y50"
                        />
                      </div>
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="client-quota-credits">
                          מכסת הודעות לקופון החדש
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
                          placeholder="למשל: 50"
                          required
                        />
                      </div>
                      <button className="us-admin-btn us-admin-btn--primary" type="submit" disabled={clientQuotaLoading}>
                        {clientQuotaLoading ? "שומר…" : clientQuotaSaved ? "קופון חדש נוסף" : "הוספת קופון נוסף ללקוח"}
                      </button>
                    </form>
                  </div>

                  <div className="us-admin-payment-block us-admin-deal-block">
                    <h3>פרטי עסקה ושיווק</h3>
                    <p className="us-admin-field-hint">
                      כמעט תמיד מותאמת אישית — ברירת המחדל היא &quot;התאמה אישית&quot;. סמנו בדיוק אילו סבבים
                      ופיצ׳רים כלולים בעסקה.
                    </p>

                    <div className="us-admin-field">
                      <label className="us-admin-field-label" htmlFor="deal-package-type">
                        סוג חבילה
                      </label>
                      <select
                        id="deal-package-type"
                        className="us-admin-field-input"
                        name="packageType"
                        value={dealDraft.packageType}
                        onChange={onDealFieldChange}
                      >
                        {PACKAGE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <fieldset className="us-admin-deal-features">
                      <legend>פיצ׳רים וסבבים כלולים</legend>
                      <div className="us-admin-deal-features__grid">
                        {FEATURE_CHECKBOXES.map((feature) => (
                          <label key={feature.key} className="us-admin-deal-check">
                            <input
                              type="checkbox"
                              checked={Boolean(dealDraft.includedFeatures?.[feature.key])}
                              onChange={() => onDealFeatureToggle(feature.key)}
                            />
                            <span>{feature.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="us-admin-field">
                      <label className="us-admin-field-label" htmlFor="deal-marketing-source">
                        מקור הגעה / שיווק
                      </label>
                      <input
                        id="deal-marketing-source"
                        className="us-admin-field-input"
                        name="marketingSource"
                        value={dealDraft.marketingSource}
                        onChange={onDealFieldChange}
                        placeholder='לדוגמה: Facebook - Linoy Lead'
                      />
                    </div>

                    <div className="us-admin-payment-fields">
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="deal-payment-amount">
                          סכום ששולם (₪)
                        </label>
                        <input
                          id="deal-payment-amount"
                          className="us-admin-field-input"
                          name="paymentAmount"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={dealDraft.paymentAmount}
                          onChange={onDealFieldChange}
                        />
                      </div>
                      <div className="us-admin-field">
                        <label className="us-admin-field-label" htmlFor="deal-payment-method">
                          אמצעי תשלום
                        </label>
                        <select
                          id="deal-payment-method"
                          className="us-admin-field-input"
                          name="paymentMethod"
                          value={dealDraft.paymentMethod}
                          onChange={onDealFieldChange}
                        >
                          {DEAL_PAYMENT_METHOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="us-admin-field">
                      <label className="us-admin-field-label" htmlFor="deal-admin-notes">
                        הערות מנהל
                      </label>
                      <textarea
                        id="deal-admin-notes"
                        className="us-admin-field-input us-admin-deal-notes"
                        name="adminNotes"
                        rows={4}
                        value={dealDraft.adminNotes}
                        onChange={onDealFieldChange}
                        placeholder="חישוב מחיר מותאם, הנחות, מגבלות מיוחדות…"
                      />
                    </div>

                    <button
                      className="us-admin-btn us-admin-btn--primary"
                      type="button"
                      disabled={dealSaving}
                      onClick={saveDeal}
                    >
                      {dealSaving ? "שומר…" : dealSaved ? "נשמר" : "שמירת פרטי עסקה"}
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
              <div className="us-admin-field">
                <label className="us-admin-field-label" htmlFor="contactPhone">
                  טלפון הכלה (איש קשר) {wizardMode === "create" ? <span className="us-admin-required">*</span> : null}
                </label>
                <input
                  id="contactPhone"
                  className="us-admin-field-input"
                  name="contactPhone"
                  type="tel"
                  value={form.contactPhone}
                  onChange={onChange}
                  placeholder="05XXXXXXXX"
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
              {welcomeNotice ? <p className="us-admin-message">{welcomeNotice}</p> : null}
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
