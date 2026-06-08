import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, HelpCircle, RotateCw, Search, Users, X } from "lucide-react";
import api from "../api";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { buildWhatsAppMessageTemplate, buildWhatsAppSendUrl } from "../utils/whatsapp";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize";
import IlInvitationEditor from "../il/components/IlInvitationEditor.jsx";
import "../us/client-portal.css";
import "../il/il-portal.css";

const initialGuest = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  giftAmount: 0,
  status: "מגיע"
};

const STATUS_OPTIONS = [
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" },
  { value: "לא ידוע", label: "לא ידוע" }
];

function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function getGuestRowClass(status) {
  if (status === "מגיע") return "il-row-coming";
  if (status === "לא מגיע") return "il-row-not-coming";
  if (status === "אולי") return "il-row-maybe";
  return "il-row-unknown";
}

function getOwnerGreeting(event) {
  if (!event) return "שלום";
  if (event.eventType === "חתונה") {
    return `שלום ${event.groomName || ""} ו${event.brideName || ""}`.trim();
  }
  if (event.eventType === "ברית") {
    return `שלום ${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim();
  }
  if (event.eventType === "בת מצווה") {
    return `שלום ${event.parentName1 || ""}`.trim();
  }
  return "שלום";
}

export default function ClientDashboardPage() {
  const { userId } = useParams();
  const [summary, setSummary] = useState({ totalInvited: 0, totalComing: 0, totalNotComing: 0, totalMaybe: 0 });
  const [importError, setImportError] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [importConflicts, setImportConflicts] = useState([]);
  const [conflictChoices, setConflictChoices] = useState({});
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importChecking, setImportChecking] = useState(false);
  const [pendingNewGuests, setPendingNewGuests] = useState([]);
  const [guests, setGuests] = useState([]);
  const [eventInfo, setEventInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [manualGuest, setManualGuest] = useState(initialGuest);
  const [editingGuestId, setEditingGuestId] = useState("");
  const [editingValues, setEditingValues] = useState({
    fullName: "",
    status: "מגיע",
    attendeesCount: 1,
    giftAmount: 0
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const [showInvitationEditor, setShowInvitationEditor] = useState(false);
  const [refreshingGuests, setRefreshingGuests] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedGuestIds, setSelectedGuestIds] = useState(() => new Set());
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [paymentCode, setPaymentCode] = useState("");
  const [customWhatsAppMessage, setCustomWhatsAppMessage] = useState("");
  const [whatsappQuota, setWhatsappQuota] = useState(null);
  const [bulkWhatsAppSending, setBulkWhatsAppSending] = useState(false);
  const [bulkWhatsAppResult, setBulkWhatsAppResult] = useState("");
  const [bulkWhatsAppError, setBulkWhatsAppError] = useState("");
  const fileInputRef = useRef(null);

  const publicLink = `${window.location.origin}/event/${userId}`;

  const filteredGuests = useMemo(() => {
    const query = appliedSearch.trim().toLowerCase();
    if (!query) return guests;
    return guests.filter((guest) => {
      const fullName = String(guest.fullName || "").toLowerCase();
      const phone = String(guest.phone || "");
      return fullName.includes(query) || phone.includes(query);
    });
  }, [guests, appliedSearch]);

  const loadWhatsappQuota = async () => {
    try {
      const response = await api.get(`/client/${userId}/whatsapp/quota`);
      const quota = response.data?.quota || null;
      setWhatsappQuota(quota);
      if (quota?.code) {
        setPaymentCode(quota.code);
      }
    } catch {
      setWhatsappQuota(null);
    }
  };

  const loadGuests = async () => {
    const response = await api.get(`/client/${userId}/guests`);
    setSummary(response.data.summary);
    setGuests(response.data.guests);
    setEventInfo(response.data.event || null);
    await loadWhatsappQuota();
  };

  const refreshGuests = async () => {
    setRefreshingGuests(true);
    try {
      await loadGuests();
    } finally {
      setRefreshingGuests(false);
    }
  };

  useEffect(() => {
    loadGuests();
  }, [userId]);

  const onManualChange = (event) => {
    const { name, value } = event.target;
    setManualGuest((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" || name === "giftAmount" ? Number(value) : value
    }));
  };

  const setManualStatus = (status) => {
    setManualGuest((prev) => ({ ...prev, status }));
  };

  const addManualGuest = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/client/${userId}/guests/manual`, {
        ...manualGuest,
        phone: normalizeIsraeliPhone(manualGuest.phone)
      });
      setManualGuest(initialGuest);
      setShowModal(false);
      loadGuests();
    } catch (manualErr) {
      setImportError(manualErr.response?.data?.message || "הוספת מוזמן נכשלה");
    }
  };

  const defaultWhatsAppTemplate = useMemo(() => {
    if (!eventInfo) return "";
    return buildWhatsAppMessageTemplate({
      event: eventInfo,
      eventId: userId,
      origin: window.location.origin
    });
  }, [eventInfo, userId]);

  useEffect(() => {
    if (defaultWhatsAppTemplate && !customWhatsAppMessage) {
      setCustomWhatsAppMessage(defaultWhatsAppTemplate);
    }
  }, [defaultWhatsAppTemplate, customWhatsAppMessage]);

  const selectedCount = selectedGuestIds.size;
  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((guest) => selectedGuestIds.has(guest._id));

  const toggleGuestSelection = (guestId) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredGuests.forEach((guest) => next.delete(guest._id));
      } else {
        filteredGuests.forEach((guest) => next.add(guest._id));
      }
      return next;
    });
  };

  const openBulkWhatsApp = () => {
    setBulkWhatsAppResult("");
    setBulkWhatsAppError("");
    if (!customWhatsAppMessage && defaultWhatsAppTemplate) {
      setCustomWhatsAppMessage(defaultWhatsAppTemplate);
    }
    setShowBulkWhatsApp(true);
  };

  const sendBulkWhatsApp = async (event) => {
    event.preventDefault();
    if (!selectedCount) {
      setBulkWhatsAppError("יש לבחור לפחות מוזמן אחד מהטבלה");
      return;
    }
    if (!paymentCode.trim()) {
      setBulkWhatsAppError("יש להזין קוד רכישה");
      return;
    }

    setBulkWhatsAppSending(true);
    setBulkWhatsAppResult("");
    setBulkWhatsAppError("");
    try {
      const response = await api.post(`/client/${userId}/whatsapp/bulk-send`, {
        paymentCode: paymentCode.trim(),
        guestIds: [...selectedGuestIds],
        customMessage: customWhatsAppMessage.trim() || defaultWhatsAppTemplate
      });

      if (response.data?.success === false) {
        setBulkWhatsAppResult("");
        setBulkWhatsAppError(response.data?.message || "שליחת ההודעות נכשלה");
        return;
      }

      setBulkWhatsAppError("");
      setBulkWhatsAppResult(response.data?.message || "ההודעות נשלחו בהצלחה");
      if (!response.data?.partial) {
        setSelectedGuestIds(new Set());
      }
      if (typeof response.data?.remaining === "number") {
        setWhatsappQuota((prev) =>
          prev ? { ...prev, remaining_credits: response.data.remaining } : prev
        );
      } else {
        await loadWhatsappQuota();
      }
    } catch (bulkErr) {
      setBulkWhatsAppResult("");
      setBulkWhatsAppError(
        bulkErr.response?.data?.message || "שליחת ההודעה נכשלה, נא לוודא שמספר המערכת מוגדר כראוי"
      );
    } finally {
      setBulkWhatsAppSending(false);
    }
  };

  const getWhatsappLink = useCallback(
    (phone) =>
      buildWhatsAppSendUrl({
        phone,
        event: eventInfo,
        eventId: userId,
        origin: window.location.origin
      }),
    [eventInfo, userId]
  );

  const sourceLabel = (source) => {
    if (source === "excel") return "קובץ אקסל";
    if (source === "excel_and_form") return "הועלה מאקסל ואישר עצמית";
    if (source === "form" || source === "public") return "אישור הגעה עצמי";
    return "ידני";
  };

  const mapRowToGuest = (row) => {
    const fullName = String(row["שם מלא"] ?? row["fullName"] ?? row["name"] ?? "").trim();
    const phone = normalizeIsraeliPhone(row["טלפון"] ?? row["phone"] ?? "");
    const amountRaw =
      row["כמות"] ??
      row["כמות מגיעים"] ??
      row["כמות אנשים"] ??
      row["מוזמנים"] ??
      row["amount"] ??
      row["count"] ??
      row["attendeesCount"];
    const attendeesCount = Math.max(1, parseAttendeesCount(amountRaw));
    return { fullName, phone, attendeesCount, status: "לא ידוע" };
  };

  const finalizeImport = async (newGuests, resolutions) => {
    await api.post(`/client/${userId}/guests/import`, { newGuests, resolutions });
    await loadGuests();
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError("");
    setImportChecking(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames?.length) {
        setImportError("קובץ האקסל ריק או לא תקין.");
        return;
      }
      const firstSheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "", raw: false });
      const guestsToImport = rows.map(mapRowToGuest).filter((row) => row.fullName && row.phone);
      if (!guestsToImport.length) {
        setImportError("לא נמצאו שורות תקינות. ודאו שיש עמודות: שם מלא, טלפון, וכמות (אופציונלי).");
        return;
      }

      const precheck = await api.post(`/client/${userId}/guests/import/precheck`, { guests: guestsToImport });
      const conflicts = precheck.data?.conflicts || [];
      const newGuests = precheck.data?.newGuests || [];
      setPendingNewGuests(newGuests);

      if (conflicts.length > 0) {
        const defaults = {};
        conflicts.forEach((item) => {
          defaults[item.phone] = "keep_existing";
        });
        setImportConflicts(conflicts);
        setConflictChoices(defaults);
        setShowConflictModal(true);
        return;
      }

      await finalizeImport(newGuests, []);
    } catch (importErr) {
      const serverMessage = importErr.response?.data?.message || importErr.response?.data?.error;
      setImportError(serverMessage || "העלאת קובץ האקסל נכשלה. בדקו את הפורמט ונסו שוב.");
    } finally {
      setImportChecking(false);
      event.target.value = "";
    }
  };

  const exportGuests = () => {
    import("xlsx").then((XLSX) => {
      const rows = guests.map((guest) => ({
        "שם מלא": guest.fullName,
        טלפון: guest.phone,
        "סטטוס הגעה": guest.status,
        "כמות מגיעים": guest.attendeesCount,
        "סכום מתנה": guest.giftAmount || 0,
        מקור: sourceLabel(guest.source)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");
      XLSX.writeFile(workbook, "guests.xlsx");
    });
  };

  const downloadTemplate = () => {
    import("xlsx").then((XLSX) => {
      const rows = [{ "שם מלא": "ישראל ישראלי", טלפון: "0501234567", "כמות אנשים": 2 }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "guests-template.xlsx");
    });
  };

  const startEdit = (guest) => {
    setEditingGuestId(guest._id);
    setEditingValues({
      fullName: guest.fullName || "",
      status: guest.status,
      attendeesCount: guest.attendeesCount,
      giftAmount: guest.giftAmount || 0
    });
  };

  const saveEdit = async (guestId) => {
    await api.patch(`/client/${userId}/guests/${guestId}`, editingValues);
    setEditingGuestId("");
    await loadGuests();
  };

  const setConflictChoice = (phone, choice) => {
    setConflictChoices((prev) => ({ ...prev, [phone]: choice }));
  };

  const closeConflictModal = () => {
    setShowConflictModal(false);
    setImportConflicts([]);
    setConflictChoices({});
    setPendingNewGuests([]);
  };

  const applyConflictResolutions = async () => {
    setImportSubmitting(true);
    setImportError("");
    try {
      const resolutions = importConflicts.map((item) => ({
        phone: item.phone,
        choice: conflictChoices[item.phone] || "keep_existing",
        excel: item.excel
      }));
      await finalizeImport(pendingNewGuests, resolutions);
      closeConflictModal();
    } catch (resolveErr) {
      setImportError(resolveErr.response?.data?.message || "שמירת הייבוא נכשלה");
    } finally {
      setImportSubmitting(false);
    }
  };

  const copyPublicLink = async () => {
    await navigator.clipboard.writeText(publicLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1600);
  };

  const applySearch = () => {
    setAppliedSearch(searchInput);
  };

  return (
    <div className="us-client-portal il-client-portal us-dashboard-shell" dir="rtl" lang="he">
      <div className="us-dashboard-content">
        <header className="us-dashboard-header">
          <h1>{getOwnerGreeting(eventInfo)}</h1>
          <p>ניהול אורחים ואישורי הגעה לאירוע</p>
          <div className="us-public-link-box">
            <span>קישור ציבורי לאישור הגעה:</span>
            <a href={publicLink} target="_blank" rel="noreferrer">
              {publicLink}
            </a>
            <button className="us-btn" type="button" onClick={copyPublicLink}>
              {linkCopied ? "הועתק" : "העתק קישור"}
            </button>
            <button
              className="us-btn us-btn--design-portal"
              type="button"
              onClick={() => setShowInvitationEditor(true)}
            >
              ✨ עריכת הזמנה ותצוגה חיה
            </button>
            <Link className="us-btn us-btn--primary il-seating-nav-btn" to={`/client/dashboard/${userId}/seating`}>
              🪑 מערכת הושבה
            </Link>
          </div>
        </header>

        <div className="us-stats-grid">
          <div className="us-stat-card">
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Users size={20} aria-hidden="true" />
              <h3>סה״כ מוזמנים</h3>
            </div>
            <p>{summary.totalInvited ?? summary.totalComing + summary.totalNotComing + summary.totalMaybe}</p>
          </div>
          <div className="us-stat-card us-stat-card--coming">
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Check size={20} aria-hidden="true" />
              <h3>סה״כ מגיעים</h3>
            </div>
            <p>{summary.totalComing}</p>
          </div>
          <div className="us-stat-card us-stat-card--not-coming">
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <X size={20} aria-hidden="true" />
              <h3>סה״כ לא מגיעים</h3>
            </div>
            <p>{summary.totalNotComing}</p>
          </div>
          <div className="us-stat-card us-stat-card--maybe">
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <HelpCircle size={20} aria-hidden="true" />
              <h3>סה״כ אולי</h3>
            </div>
            <p>{summary.totalMaybe}</p>
          </div>
        </div>

        <div className="us-toolbar">
          <button
            className="us-btn"
            type="button"
            onClick={refreshGuests}
            disabled={refreshingGuests}
            aria-label="רענון רשימת מוזמנים"
            title="רענון"
          >
            <RotateCw size={16} className={refreshingGuests ? "spinning" : ""} />
          </button>
          <button className="us-btn us-btn--primary" type="button" onClick={() => setShowModal(true)}>
            הוספת מוזמן ידנית
          </button>
          <button className="us-btn" type="button" onClick={() => fileInputRef.current?.click()} disabled={importChecking}>
            {importChecking ? "בודק קובץ…" : "העלאת מוזמנים מאקסל"}
          </button>
          <button className="us-btn" type="button" onClick={exportGuests}>
            ייצוא לאקסל
          </button>
          <button className="us-btn il-bulk-send-btn" type="button" onClick={openBulkWhatsApp}>
            {selectedCount > 0 ? `שלח ווצאפ ל-${selectedCount} מוזמנים` : "שלח ווצאפ בתפוצה רחבה"}
          </button>
          <button className="us-btn" type="button" onClick={downloadTemplate}>
            הורדת קובץ אקסל לדוגמה
          </button>
          <div className="us-search-wrap">
            <input
              className="us-search-input"
              type="text"
              placeholder="חיפוש שם / טלפון"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
            <button className="us-btn" type="button" onClick={applySearch} aria-label="חפש">
              <Search size={16} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden-file-input"
            onChange={onImportFile}
          />
        </div>
        {importError ? <p className="us-error-message us-error-message--left">{importError}</p> : null}

        <div className="us-table-wrap">
          <table className="us-guest-table">
            <thead>
              <tr>
                <th className="il-col-check">
                  <input
                    type="checkbox"
                    aria-label="בחירת כל המוזמנים המוצגים"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    disabled={!filteredGuests.length}
                  />
                </th>
                <th>שם מלא</th>
                <th>טלפון</th>
                <th>כמה מגיעים</th>
                <th>סכום מתנה</th>
                <th>סטטוס</th>
                <th>מקור</th>
                <th>וואטסאפ</th>
                <th>עריכה</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="us-table-empty">
                    {appliedSearch ? "לא נמצאו תוצאות לחיפוש" : "אין אורחים עדיין"}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr key={guest._id} className={getGuestRowClass(guest.status)}>
                    <td data-label="בחירה" className="il-col-check">
                      <input
                        type="checkbox"
                        aria-label={`בחירת ${guest.fullName}`}
                        checked={selectedGuestIds.has(guest._id)}
                        onChange={() => toggleGuestSelection(guest._id)}
                      />
                    </td>
                    <td data-label="שם מלא">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="text"
                          value={editingValues.fullName}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, fullName: event.target.value }))
                          }
                          required
                        />
                      ) : (
                        guest.fullName
                      )}
                    </td>
                    <td data-label="טלפון" dir="ltr">
                      {guest.phone}
                    </td>
                    <td data-label="כמה מגיעים">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="number"
                          min="0"
                          value={editingValues.attendeesCount}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, attendeesCount: Number(event.target.value) }))
                          }
                        />
                      ) : (
                        guest.attendeesCount
                      )}
                    </td>
                    <td data-label="סכום מתנה">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="number"
                          min="0"
                          value={editingValues.giftAmount || 0}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, giftAmount: Number(event.target.value) }))
                          }
                        />
                      ) : (
                        guest.giftAmount || 0
                      )}
                    </td>
                    <td data-label="סטטוס">
                      {editingGuestId === guest._id ? (
                        <select
                          className="us-inline-input"
                          value={editingValues.status}
                          onChange={(event) => setEditingValues((prev) => ({ ...prev, status: event.target.value }))}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        guest.status
                      )}
                    </td>
                    <td data-label="מקור">
                      <span>{sourceLabel(guest.source)}</span>
                    </td>
                    <td data-label="וואטסאפ">
                      <a
                        className="us-whatsapp-link"
                        href={getWhatsappLink(guest.phone)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="שליחת הודעת וואטסאפ"
                        title="שליחת וואטסאפ"
                      >
                        <WhatsAppIcon size={20} />
                      </a>
                    </td>
                    <td data-label="עריכה">
                      {editingGuestId === guest._id ? (
                        <button className="us-btn us-btn--primary" type="button" onClick={() => saveEdit(guest._id)}>
                          שמירה
                        </button>
                      ) : (
                        <button className="us-btn" type="button" onClick={() => startEdit(guest)}>
                          עריכה
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showConflictModal ? (
          <div className="us-modal-backdrop" role="presentation">
            <div className="us-modal-card">
              <h2 className="us-modal-title">נמצאו מוזמנים עם מספר טלפון קיים</h2>
              <p className="us-login-subtitle us-login-subtitle--left">
                זוהו {importConflicts.length} רשומות חופפות. בחרו לכל רשומה האם להשאיר את הקיים או לעדכן לפי האקסל.
                לאחר מכן לחצו &quot;אשר והמשך שמירה&quot;.
                {pendingNewGuests.length > 0 ? <> בנוסף, {pendingNewGuests.length} מוזמנים חדשים יתווספו אוטומטית עם האישור.</> : null}
              </p>
              <div className="mt-4 space-y-4">
                {importConflicts.map((item) => (
                  <div key={item.phone} className="us-conflict-card">
                    <p className="us-dashboard-emphasis text-sm" dir="ltr">
                      {item.phone}
                    </p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                      <div>
                        <span className="us-dashboard-emphasis">מה קיים כרגע במערכת:</span> {item.existing.fullName} | כמות{" "}
                        {item.existing.attendeesCount} | מקור: {sourceLabel(item.existing.source)}
                      </div>
                      <div>
                        <span className="us-dashboard-emphasis">מה מנסים להעלות מהאקסל:</span> {item.excel.fullName} | כמות{" "}
                        {item.excel.attendeesCount}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                      <label>
                        <input
                          type="radio"
                          name={`conflict-${item.phone}`}
                          checked={(conflictChoices[item.phone] || "keep_existing") === "keep_existing"}
                          onChange={() => setConflictChoice(item.phone, "keep_existing")}
                        />{" "}
                        🔹 השאר את הקיים
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`conflict-${item.phone}`}
                          checked={conflictChoices[item.phone] === "use_excel"}
                          onChange={() => setConflictChoice(item.phone, "use_excel")}
                        />{" "}
                        🔸 עדכן לפי האקסל החדש
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="button" disabled={importSubmitting} onClick={applyConflictResolutions}>
                  {importSubmitting ? "שומר…" : "אשר והמשך שמירה"}
                </button>
                <button className="us-btn" type="button" onClick={closeConflictModal}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showModal ? (
          <div className="us-modal-backdrop" role="presentation">
            <form className="us-modal-card" onSubmit={addManualGuest}>
              <h2 className="us-modal-title">הוספת רשומה ידנית</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="us-field-label" htmlFor="manual-fullName">
                    שם מלא
                  </label>
                  <input
                    id="manual-fullName"
                    className="us-field-input"
                    name="fullName"
                    value={manualGuest.fullName}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-phone">
                    טלפון
                  </label>
                  <input
                    id="manual-phone"
                    className="us-field-input"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    value={manualGuest.phone}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-attendeesCount">
                    כמות מגיעים
                  </label>
                  <input
                    id="manual-attendeesCount"
                    className="us-field-input"
                    name="attendeesCount"
                    type="number"
                    min="0"
                    value={manualGuest.attendeesCount}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-giftAmount">
                    סכום מתנה (₪)
                  </label>
                  <input
                    id="manual-giftAmount"
                    className="us-field-input"
                    name="giftAmount"
                    type="number"
                    min="0"
                    value={manualGuest.giftAmount}
                    onChange={onManualChange}
                  />
                </div>
                <div>
                  <span className="us-field-label">סטטוס</span>
                  <div className="il-status-group mt-2" role="group" aria-label="סטטוס">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`il-status-btn ${manualGuest.status === option.value ? "is-selected" : ""}`}
                        onClick={() => setManualStatus(option.value)}
                        aria-pressed={manualGuest.status === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="submit">
                  שמירה
                </button>
                <button className="us-btn" type="button" onClick={() => setShowModal(false)}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {showBulkWhatsApp ? (
          <div className="us-modal-backdrop" role="presentation">
            <form className="us-modal-card il-bulk-whatsapp-modal" onSubmit={sendBulkWhatsApp}>
              <h2 className="us-modal-title">תפוצה רחבה</h2>
              <p className="il-bulk-whatsapp-intro">
                על מנת לשלוח הודעות אישורי הגעה בתפוצה רחבה יש לרכוש את השירות. פנו למנהל המערכת וספקו קוד.
                <br />
                <strong>שימו לב:</strong> המספר נשלח מחברת momoEVENT.
              </p>
              {whatsappQuota ? (
                <p className="il-bulk-whatsapp-quota">
                  מכסה פעילה: נותרו <strong>{whatsappQuota.remaining_credits}</strong> / {whatsappQuota.total_credits}{" "}
                  הודעות
                </p>
              ) : null}
              <div className="mt-4 space-y-4">
                <div>
                  <label className="us-field-label" htmlFor="bulk-payment-code">
                    קוד רכישה
                  </label>
                  <input
                    id="bulk-payment-code"
                    className="us-field-input"
                    value={paymentCode}
                    onChange={(event) => setPaymentCode(event.target.value.toUpperCase())}
                    placeholder="הזינו את הקוד שקיבלתם מהמנהל"
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="bulk-whatsapp-message">
                    נוסח ההודעה (השתמשו ב-[שם] לשם המוזמן)
                  </label>
                  <textarea
                    id="bulk-whatsapp-message"
                    className="us-field-input il-bulk-whatsapp-textarea"
                    rows={9}
                    value={customWhatsAppMessage}
                    onChange={(event) => setCustomWhatsAppMessage(event.target.value)}
                    required
                  />
                </div>
                <p className="il-bulk-whatsapp-selected">
                  נבחרו לשליחה: <strong>{selectedCount}</strong> מוזמנים
                </p>
                {bulkWhatsAppError ? (
                  <div className="il-bulk-whatsapp-alert" role="alert">
                    <strong>שליחה נכשלה</strong>
                    <p>{bulkWhatsAppError}</p>
                  </div>
                ) : null}
                {bulkWhatsAppResult ? (
                  <div className="il-bulk-whatsapp-success-box" role="status">
                    <p>{bulkWhatsAppResult}</p>
                  </div>
                ) : null}
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn il-bulk-send-btn" type="submit" disabled={bulkWhatsAppSending || !selectedCount}>
                  {bulkWhatsAppSending ? "שולח…" : `שליחה ל-${selectedCount} מוזמנים`}
                </button>
                <button className="us-btn" type="button" onClick={() => setShowBulkWhatsApp(false)}>
                  סגירה
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {showInvitationEditor && eventInfo ? (
          <IlInvitationEditor
            userId={userId}
            eventInfo={eventInfo}
            onClose={() => setShowInvitationEditor(false)}
            onSaved={(updatedEvent) => {
              setEventInfo(updatedEvent);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
