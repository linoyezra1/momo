import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, HelpCircle, RotateCw, Search, Users, X } from "lucide-react";
import api from "../api";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { buildWhatsAppSendUrl } from "../utils/whatsapp";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize";

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
  if (status === "מגיע") return "table-row-coming";
  if (status === "לא מגיע") return "table-row-not-coming";
  if (status === "אולי") return "table-row-maybe";
  return "table-row-unknown";
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
  const [refreshingGuests, setRefreshingGuests] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
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

  const loadGuests = async () => {
    const response = await api.get(`/client/${userId}/guests`);
    setSummary(response.data.summary);
    setGuests(response.data.guests);
    setEventInfo(response.data.event || null);
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

  const onImportClick = () => fileInputRef.current?.click();

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
    <div className="page-shell dashboard-shell">
      <div className="page-container dashboard-page">
        <header className="page-header">
          <h1>{getOwnerGreeting(eventInfo)}</h1>
          <p>ניהול אורחים ואישורי הגעה לאירוע</p>
          <div className="public-link-box">
            <span className="public-link-label">קישור ציבורי לאישור הגעה:</span>
            <a href={publicLink} target="_blank" rel="noreferrer">
              {publicLink}
            </a>
            <button className="btn btn-neutral btn-xs" type="button" onClick={copyPublicLink}>
              {linkCopied ? "הועתק" : "העתק קישור"}
            </button>
          </div>
        </header>

        <div className="stats-grid dashboard-stats">
          <div className="stat-card stat-card--total">
            <div className="stat-card-head">
              <Users className="stat-card-icon" size={22} strokeWidth={2} aria-hidden="true" />
              <h3>סה״כ מוזמנים</h3>
            </div>
            <p>{summary.totalInvited ?? summary.totalComing + summary.totalNotComing + summary.totalMaybe}</p>
          </div>
          <div className="stat-card stat-card--coming">
            <div className="stat-card-head">
              <Check className="stat-card-icon" size={22} strokeWidth={2.5} aria-hidden="true" />
              <h3>סה״כ מגיעים</h3>
            </div>
            <p>{summary.totalComing}</p>
          </div>
          <div className="stat-card stat-card--not-coming">
            <div className="stat-card-head">
              <X className="stat-card-icon" size={22} strokeWidth={2.5} aria-hidden="true" />
              <h3>סה״כ לא מגיעים</h3>
            </div>
            <p>{summary.totalNotComing}</p>
          </div>
          <div className="stat-card stat-card--maybe">
            <div className="stat-card-head">
              <HelpCircle className="stat-card-icon" size={22} strokeWidth={2} aria-hidden="true" />
              <h3>סה״כ אולי</h3>
            </div>
            <p>{summary.totalMaybe}</p>
          </div>
        </div>

        <div className="toolbar dashboard-toolbar dashboard-toolbar-compact">
          <button
            className="btn btn-icon-refresh"
            type="button"
            onClick={refreshGuests}
            disabled={refreshingGuests}
            aria-label="רענון רשימת מוזמנים"
            title="רענון"
          >
            <RotateCw size={16} className={refreshingGuests ? "spinning" : ""} />
          </button>
          <button className="btn btn-primary btn-compact" type="button" onClick={() => setShowModal(true)}>
            הוספת מוזמן ידנית
          </button>
          <button className="btn btn-neutral btn-compact" type="button" onClick={onImportClick} disabled={importChecking}>
            {importChecking ? "בודק קובץ…" : "העלאת מוזמנים מאקסל"}
          </button>
          <button className="btn btn-neutral btn-compact" type="button" onClick={exportGuests}>
            ייצוא לאקסל
          </button>
          <button className="btn btn-neutral btn-compact btn-link-like" type="button" onClick={downloadTemplate}>
            הורדת קובץ אקסל לדוגמה
          </button>
          <div className="dashboard-search">
            <input
              className="field-input dashboard-search-input"
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
            <button className="btn btn-neutral btn-icon-refresh" type="button" onClick={applySearch} aria-label="חפש">
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
        {importError ? <p className="message message--error">{importError}</p> : null}

        <div className="card table-wrap dashboard-table-wrap dashboard-table-scroll">
          <table className="table dashboard-guests-table">
            <thead>
              <tr>
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
                  <td colSpan={8}>{appliedSearch ? "לא נמצאו תוצאות לחיפוש" : "אין אורחים עדיין"}</td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr key={guest._id} className={getGuestRowClass(guest.status)}>
                    <td data-label="שם מלא">
                      {editingGuestId === guest._id ? (
                        <input
                          className="table-inline-input table-inline-input--wide"
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
                      {editingGuestId === guest._id ? (
                        <span className="table-phone-readonly" title="מספר הטלפון אינו ניתן לעריכה">
                          {guest.phone}
                        </span>
                      ) : (
                        guest.phone
                      )}
                    </td>
                    <td data-label="כמה מגיעים">
                      {editingGuestId === guest._id ? (
                        <input
                          className="table-inline-input"
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
                          className="table-inline-input"
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
                          className="table-inline-input"
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
                      <span className="source-badge">{sourceLabel(guest.source)}</span>
                    </td>
                    <td data-label="וואטסאפ">
                      <a
                        className="whatsapp-link"
                        href={getWhatsappLink(guest.phone)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="שליחת הודעת וואטסאפ"
                        title="שליחת וואטסאפ"
                      >
                        <WhatsAppIcon size={22} />
                      </a>
                    </td>
                    <td data-label="עריכה">
                      {editingGuestId === guest._id ? (
                        <button className="btn btn-secondary btn-xs" type="button" onClick={() => saveEdit(guest._id)}>
                          שמירה
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-xs" type="button" onClick={() => startEdit(guest)}>
                          ✎
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
          <div className="modal-backdrop" role="presentation">
            <div className="card modal-card modal-card-scroll modal-card--mobile conflict-modal">
              <h2 className="card-title">נמצאו מוזמנים עם מספר טלפון קיים</h2>
              <p className="conflict-modal-intro">
                זוהו {importConflicts.length} רשומות חופפות. לא בוצעה שמירה אוטומטית — בחרו לכל רשומה האם
                להשאיר את הקיים או לעדכן לפי האקסל. לאחר מכן לחצו &quot;אשר והמשך שמירה&quot;.
                {pendingNewGuests.length > 0 ? (
                  <>
                    {" "}
                    בנוסף, {pendingNewGuests.length} מוזמנים חדשים יתווספו אוטומטית עם האישור.
                  </>
                ) : null}
              </p>
              <div className="conflict-list">
                {importConflicts.map((item) => (
                  <div key={item.phone} className="conflict-item">
                    <p className="conflict-item-phone" dir="ltr">
                      {item.phone}
                    </p>
                    <div className="conflict-compare">
                      <div className="conflict-compare-col">
                        <span className="conflict-compare-label">מה קיים כרגע במערכת</span>
                        <p>
                          {item.existing.fullName} | כמות {item.existing.attendeesCount} | מקור:{" "}
                          {sourceLabel(item.existing.source)}
                        </p>
                      </div>
                      <div className="conflict-compare-col conflict-compare-col--excel">
                        <span className="conflict-compare-label">מה מנסים להעלות מהאקסל</span>
                        <p>
                          {item.excel.fullName} | כמות {item.excel.attendeesCount}
                        </p>
                      </div>
                    </div>
                    <div className="conflict-options" role="radiogroup" aria-label={`בחירה עבור ${item.existing.fullName}`}>
                      <label className="conflict-option">
                        <input
                          type="radio"
                          name={`conflict-${item.phone}`}
                          value="keep_existing"
                          checked={(conflictChoices[item.phone] || "keep_existing") === "keep_existing"}
                          onChange={() => setConflictChoice(item.phone, "keep_existing")}
                        />
                        🔹 השאר את הקיים
                      </label>
                      <label className="conflict-option">
                        <input
                          type="radio"
                          name={`conflict-${item.phone}`}
                          value="use_excel"
                          checked={conflictChoices[item.phone] === "use_excel"}
                          onChange={() => setConflictChoice(item.phone, "use_excel")}
                        />
                        🔸 עדכן לפי האקסל החדש
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="toolbar">
                <button className="btn btn-primary" type="button" disabled={importSubmitting} onClick={applyConflictResolutions}>
                  {importSubmitting ? "שומר…" : "אשר והמשך שמירה"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={closeConflictModal}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showModal ? (
          <div className="modal-backdrop" role="presentation">
            <form className="card modal-card modal-card--mobile form-stack" onSubmit={addManualGuest}>
              <h2 className="card-title">הוספת רשומה ידנית</h2>
              <div className="field">
                <label className="field-label" htmlFor="manual-fullName">
                  שם מלא
                </label>
                <input
                  id="manual-fullName"
                  className="field-input"
                  name="fullName"
                  value={manualGuest.fullName}
                  onChange={onManualChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="manual-phone">
                  טלפון
                </label>
                <input
                  id="manual-phone"
                  className="field-input"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  value={manualGuest.phone}
                  onChange={onManualChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="manual-attendeesCount">
                  כמות מגיעים
                </label>
                <input
                  id="manual-attendeesCount"
                  className="field-input"
                  name="attendeesCount"
                  type="number"
                  min="0"
                  value={manualGuest.attendeesCount}
                  onChange={onManualChange}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="manual-giftAmount">
                  סכום מתנה (€/₪)
                </label>
                <input
                  id="manual-giftAmount"
                  className="field-input"
                  name="giftAmount"
                  type="number"
                  min="0"
                  value={manualGuest.giftAmount}
                  onChange={onManualChange}
                />
              </div>
              <div className="field">
                <span className="field-label">סטטוס</span>
                <div className="status-group status-group--horizontal" role="group" aria-label="סטטוס">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn status-btn ${manualGuest.status === option.value ? "is-selected" : ""}`}
                      onClick={() => setManualStatus(option.value)}
                      aria-pressed={manualGuest.status === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="toolbar">
                <button className="btn btn-primary" type="submit">
                  שמירה
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
