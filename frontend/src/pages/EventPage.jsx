import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const initialRsvp = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "מגיע"
};

export default function EventPage() {
  const { eventId } = useParams();
  const [eventData, setEventData] = useState(null);
  const [form, setForm] = useState(initialRsvp);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/public/event/${eventId}`)
      .then((response) => setEventData(response.data))
      .catch(() => setError("לא ניתן לטעון את פרטי האירוע"));
  }, [eventId]);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.post(`/public/event/${eventId}/rsvp`, form);
      setMessage("תודה! האישור נשמר בהצלחה");
      setForm(initialRsvp);
    } catch {
      setError("שליחת הטופס נכשלה");
    }
  };

  return (
    <div className="container">
      {eventData ? (
        <div className="card">
          <h1>{eventData.event.eventNames}</h1>
          <p>{eventData.event.eventType}</p>
          <p>
            {eventData.event.venueName}, {eventData.event.city}, {eventData.event.streetAndNumber}
          </p>
          <p>
            {eventData.event.eventDate} בשעה {eventData.event.eventTime}
          </p>
        </div>
      ) : null}

      <form className="card form-grid" onSubmit={onSubmit}>
        <h2>אישור הגעה</h2>
        <input name="fullName" placeholder="שם מלא" value={form.fullName} onChange={onChange} required />
        <input name="phone" placeholder="טלפון" value={form.phone} onChange={onChange} required />
        <input
          name="attendeesCount"
          type="number"
          min="0"
          value={form.attendeesCount}
          onChange={onChange}
          required
        />
        <select name="status" value={form.status} onChange={onChange}>
          <option value="מגיע">מגיע</option>
          <option value="לא מגיע">לא מגיע</option>
          <option value="אולי">אולי</option>
        </select>
        <button type="submit">שליחה</button>
      </form>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
