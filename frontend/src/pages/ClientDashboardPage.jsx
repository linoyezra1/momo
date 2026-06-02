import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const initialGuest = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "מגיע"
};

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
    <div className="container">
      <h1>דשבורד לקוח</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>סה"כ מגיעים</h3>
          <p>{summary.totalComing}</p>
        </div>
        <div className="stat-card">
          <h3>סה"כ לא מגיעים</h3>
          <p>{summary.totalNotComing}</p>
        </div>
        <div className="stat-card">
          <h3>סה"כ אולי</h3>
          <p>{summary.totalMaybe}</p>
        </div>
      </div>

      <button onClick={() => setShowModal(true)}>הוספת מוזמן ידנית</button>

      {showModal ? (
        <form className="card form-grid" onSubmit={addManualGuest}>
          <h2>הוספת רשומה ידנית</h2>
          <input
            placeholder="שם מלא"
            value={manualGuest.fullName}
            onChange={(event) => setManualGuest((prev) => ({ ...prev, fullName: event.target.value }))}
            required
          />
          <input
            placeholder="טלפון"
            value={manualGuest.phone}
            onChange={(event) => setManualGuest((prev) => ({ ...prev, phone: event.target.value }))}
            required
          />
          <input
            type="number"
            min="0"
            value={manualGuest.attendeesCount}
            onChange={(event) => setManualGuest((prev) => ({ ...prev, attendeesCount: Number(event.target.value) }))}
            required
          />
          <select
            value={manualGuest.status}
            onChange={(event) => setManualGuest((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="מגיע">מגיע</option>
            <option value="לא מגיע">לא מגיע</option>
            <option value="אולי">אולי</option>
          </select>
          <button type="submit">שמירה</button>
          <button type="button" onClick={() => setShowModal(false)}>
            ביטול
          </button>
        </form>
      ) : null}

      <table className="card table">
        <thead>
          <tr>
            <th>שם מלא</th>
            <th>טלפון</th>
            <th>כמה מגיעים</th>
            <th>סטטוס</th>
            <th>ווצאפ</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <tr key={guest._id}>
              <td>{guest.fullName}</td>
              <td>{guest.phone}</td>
              <td>{guest.attendeesCount}</td>
              <td>{guest.status}</td>
              <td>
                <a href={toWhatsappLink(guest.phone, guest.fullName)} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
