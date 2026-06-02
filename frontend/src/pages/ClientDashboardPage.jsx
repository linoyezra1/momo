import { useEffect, useState } from "react";
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
        </div>

        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>שם מלא</th>
                <th>טלפון</th>
                <th>כמה מגיעים</th>
                <th>סטטוס</th>
                <th>וואטסאפ</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={5}>אין אורחים עדיין</td>
                </tr>
              ) : (
                guests.map((guest) => (
                  <tr key={guest._id}>
                    <td>{guest.fullName}</td>
                    <td dir="ltr">{guest.phone}</td>
                    <td>{guest.attendeesCount}</td>
                    <td>{guest.status}</td>
                    <td>
                      <a href={toWhatsappLink(guest.phone, guest.fullName)} target="_blank" rel="noreferrer">
                        שליחה
                      </a>
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
