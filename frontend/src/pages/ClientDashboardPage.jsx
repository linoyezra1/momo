import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const initialGuest = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "מגיע"
};

const STATUS_OPTIONS = [
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" }
];

export default function ClientDashboardPage() {
  const { userId } = useParams();
  const [summary, setSummary] = useState({ totalComing: 0, totalNotComing: 0, totalMaybe: 0 });
  const [guests, setGuests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [manualGuest, setManualGuest] = useState(initialGuest);
  const [editingGuestId, setEditingGuestId] = useState("");
  const [editingValues, setEditingValues] = useState({ status: "מגיע", attendeesCount: 1 });
  const fileInputRef = useRef(null);

  const loadGuests = async () => {
    const response = await api.get(`/client/${userId}/guests`);
    setSummary(response.data.summary);
    setGuests(response.data.guests);
  };

  useEffect(() => {
    loadGuests();
  }, [userId]);

  const onManualChange = (event) => {
    const { name, value } = event.target;
    setManualGuest((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" ? Number(value) : value
    }));
  };

  const setManualStatus = (status) => {
    setManualGuest((prev) => ({ ...prev, status }));
  };

  const addManualGuest = async (event) => {
    event.preventDefault();
    await api.post(`/client/${userId}/guests/manual`, manualGuest);
    setManualGuest(initialGuest);
    setShowModal(false);
    loadGuests();
  };

  const toWhatsappLink = (phone, fullName) => {
    const cleanPhone = phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`היי ${fullName}, רצינו לוודא הגעה לאירוע. נשמח לעדכון.`);
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const sourceLabel = (source) => {
    if (source === "excel") return "קובץ אקסל";
    if (source === "form" || source === "public") return "אישור הגעה עצמי";
    return "ידני";
  };

  const onImportClick = () => fileInputRef.current?.click();

  const mapRowToGuest = (row) => {
    const fullName = String(row["שם מלא"] ?? row["fullName"] ?? row["name"] ?? "").trim();
    const phone = String(row["טלפון"] ?? row["phone"] ?? "").trim();
    const attendeesCount = Number(row["כמות"] ?? row["כמות מגיעים"] ?? row["attendeesCount"] ?? 1) || 1;
    return { fullName, phone, attendeesCount, status: "אולי" };
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
      const guestsToImport = rows.map(mapRowToGuest).filter((row) => row.fullName && row.phone);
      if (!guestsToImport.length) {
        return;
      }
      await api.post(`/client/${userId}/guests/import`, { guests: guestsToImport });
      await loadGuests();
    } finally {
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
      מקור: sourceLabel(guest.source)
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");
    XLSX.writeFile(workbook, "guests.xlsx");
    });
  };

  const startEdit = (guest) => {
    setEditingGuestId(guest._id);
    setEditingValues({ status: guest.status, attendeesCount: guest.attendeesCount });
  };

  const saveEdit = async (guestId) => {
    await api.patch(`/client/${userId}/guests/${guestId}`, editingValues);
    setEditingGuestId("");
    await loadGuests();
  };

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <h1>דשבורד לקוח</h1>
          <p>ניהול אורחים ואישורי הגעה</p>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>סה״כ מגיעים</h3>
            <p>{summary.totalComing}</p>
          </div>
          <div className="stat-card">
            <h3>סה״כ לא מגיעים</h3>
            <p>{summary.totalNotComing}</p>
          </div>
          <div className="stat-card">
            <h3>סה״כ אולי</h3>
            <p>{summary.totalMaybe}</p>
          </div>
        </div>

        <div className="toolbar">
          <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
            הוספת מוזמן ידנית
          </button>
          <button className="btn btn-secondary" type="button" onClick={onImportClick}>
            העלאת מוזמנים מאקסל
          </button>
          <button className="btn btn-secondary" type="button" onClick={exportGuests}>
            ייצוא לאקסל
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden-file-input"
            onChange={onImportFile}
          />
        </div>

        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>שם מלא</th>
                <th>טלפון</th>
                <th>כמה מגיעים</th>
                <th>סטטוס</th>
                <th>מקור</th>
                <th>וואטסאפ</th>
                <th>עריכה</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={7}>אין אורחים עדיין</td>
                </tr>
              ) : (
                guests.map((guest) => (
                  <tr key={guest._id}>
                    <td data-label="שם מלא">{guest.fullName}</td>
                    <td data-label="טלפון" dir="ltr">
                      {guest.phone}
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
                      <a className="whatsapp-link" href={toWhatsappLink(guest.phone, guest.fullName)} target="_blank" rel="noreferrer">
                        <img
                          src="/image_574ceb.png"
                          alt="WhatsApp"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="whatsapp-fallback" aria-hidden="true">
                          🟢
                        </span>
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

        {showModal ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setShowModal(false)}>
            <form
              className="card modal-card form-stack"
              onSubmit={addManualGuest}
              onClick={(event) => event.stopPropagation()}
            >
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
