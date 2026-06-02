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
    <div className="container">
      <h1>ממשק מנהל - יצירת לקוח</h1>
      <form className="card form-grid" onSubmit={onSubmit}>
        <input name="username" placeholder="שם משתמש" value={form.username} onChange={onChange} required />
        <input name="password" placeholder="סיסמה" value={form.password} onChange={onChange} required />
        <select name="eventType" value={form.eventType} onChange={onChange}>
          <option value="חתונה">חתונה</option>
          <option value="ברית">ברית</option>
          <option value="אחר">אחר</option>
        </select>
        <input name="eventNames" placeholder="שמות" value={form.eventNames} onChange={onChange} required />
        <input name="venueName" placeholder="שם המתחם" value={form.venueName} onChange={onChange} required />
        <input name="city" placeholder="עיר" value={form.city} onChange={onChange} required />
        <input name="streetAndNumber" placeholder="רחוב ומספר" value={form.streetAndNumber} onChange={onChange} required />
        <input type="date" name="eventDate" value={form.eventDate} onChange={onChange} required />
        <input type="time" name="eventTime" value={form.eventTime} onChange={onChange} required />
        <button disabled={loading} type="submit">
          {loading ? "שומר..." : "שמור"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <div className="card">
          <h2>הלקוח נוצר בהצלחה</h2>
          <p>שם משתמש: {result.credentials.username}</p>
          <p>סיסמה: {result.credentials.password}</p>
          <p>דשבורד לקוח: {result.clientDashboardLink}</p>
          <p>קישור ציבורי: {result.publicEventLink}</p>
        </div>
      ) : null}
    </div>
  );
}
