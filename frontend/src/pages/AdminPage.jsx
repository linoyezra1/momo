import { useState } from "react";
import api from "../api";

const initialForm = {
  username: "",
  password: "",
  eventType: "חתונה",
  eventNames: "",
  venueName: "",
  city: "",
  streetAndNumber: "",
  eventDate: "",
  eventTime: ""
};

export default function AdminPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const payload = {
        username: form.username,
        password: form.password,
        event: {
          eventType: form.eventType,
          eventNames: form.eventNames,
          venueName: form.venueName,
          city: form.city,
          streetAndNumber: form.streetAndNumber,
          eventDate: form.eventDate,
          eventTime: form.eventTime
        }
      };
      const response = await api.post("/admin/create-client", payload);
      setResult(response.data);
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.response?.data?.message || "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <h1>ממשק מנהל</h1>
          <p>יצירת לקוח חדש ואירוע</p>
        </header>

        <form className="card form-stack" onSubmit={onSubmit}>
          <h2 className="card-title">פרטי התחברות</h2>
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
              סיסמה
            </label>
            <input
              id="password"
              className="field-input"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              required
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
              <option value="אחר">אחר</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="eventNames">
              שמות
            </label>
            <input
              id="eventNames"
              className="field-input"
              name="eventNames"
              value={form.eventNames}
              onChange={onChange}
              required
            />
          </div>
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

          <button className="btn btn-primary btn-block" disabled={loading} type="submit">
            {loading ? "שומר…" : "שמור לקוח"}
          </button>
        </form>

        {error ? <p className="message message--error">{error}</p> : null}

        {result ? (
          <div className="card result-links">
            <h2 className="card-title">הלקוח נוצר בהצלחה</h2>
            <p>
              <strong>שם משתמש:</strong> {result.credentials.username}
            </p>
            <p>
              <strong>סיסמה:</strong> {result.credentials.password}
            </p>
            <p>
              <strong>דשבורד לקוח:</strong> {result.clientDashboardLink}
            </p>
            <p>
              <strong>קישור ציבורי:</strong> {result.publicEventLink}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
