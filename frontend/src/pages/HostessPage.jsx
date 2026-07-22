import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageCircle, Search, UserCheck } from "lucide-react";
import api from "../api";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/hostess.css";

export default function HostessPage() {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventLabel, setEventLabel] = useState("");
  const [guests, setGuests] = useState([]);
  const [query, setQuery] = useState("");
  const [canSendTableWhatsApp, setCanSendTableWhatsApp] = useState(false);
  const [arriveModal, setArriveModal] = useState(null);
  const [lockedModal, setLockedModal] = useState(false);
  const [actionToast, setActionToast] = useState("");
  const [busyGuestId, setBusyGuestId] = useState("");

  const loadHostess = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/hostess/${eventId}`);
      setEventLabel(data.eventLabel || "");
      setGuests(data.guests || []);
      setCanSendTableWhatsApp(Boolean(data.features?.canSendTableWhatsApp));
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מסך דיילת נכשלה");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadHostess();
  }, [loadHostess]);

  useEffect(() => {
    if (!actionToast) return undefined;
    const timer = window.setTimeout(() => setActionToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [actionToast]);

  const filteredGuests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((guest) => {
      return (
        String(guest.fullName || "").toLowerCase().includes(q) ||
        String(guest.phone || "").includes(q) ||
        String(guest.tableLabel || "").toLowerCase().includes(q)
      );
    });
  }, [guests, query]);

  const markArrived = async (guest) => {
    setBusyGuestId(guest._id);
    try {
      const { data } = await api.post(`/hostess/${eventId}/guests/${guest._id}/arrive`);
      setArriveModal({
        fullName: guest.fullName,
        tableLabel: data.tableLabel || guest.tableLabel || "",
        message: data.message
      });
      setGuests((prev) =>
        prev.map((item) =>
          item._id === guest._id ? { ...item, hostessArrivedAt: new Date().toISOString() } : item
        )
      );
    } catch (arriveError) {
      setActionToast(arriveError.response?.data?.message || "סימון הגעה נכשל");
    } finally {
      setBusyGuestId("");
    }
  };

  const sendTableWhatsApp = async (guest) => {
    if (!canSendTableWhatsApp) {
      setLockedModal(true);
      return;
    }
    setBusyGuestId(guest._id);
    try {
      const { data } = await api.post(`/hostess/${eventId}/guests/${guest._id}/send-table-whatsapp`);
      setActionToast(data.message || "ההודעה נשלחה");
    } catch (sendError) {
      if (sendError.response?.data?.code === "feature_disabled") {
        setLockedModal(true);
      } else {
        setActionToast(sendError.response?.data?.message || "שליחת WhatsApp נכשלה");
      }
    } finally {
      setBusyGuestId("");
    }
  };

  return (
    <div className="il-hostess-page" dir="rtl" lang="he">
      <header className="il-hostess-header">
        <div>
          <p className="il-hostess-eyebrow">מסך דיילת</p>
          <h1>{eventLabel || "דיילת דיגיטלית"}</h1>
          <p>חיפוש חי · סימון הגעה · שליחת מספר שולחן</p>
        </div>
      </header>

      <label className="il-hostess-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש לפי שם, טלפון או שולחן…"
          autoFocus
          aria-label="חיפוש מוזמנים"
        />
      </label>

      {error ? <p className="us-error-message">{error}</p> : null}
      {actionToast ? <p className="il-hostess-toast" role="status">{actionToast}</p> : null}
      {loading ? <p>טוען…</p> : null}

      <ul className="il-hostess-list">
        {!loading && !filteredGuests.length ? (
          <li className="il-hostess-empty">לא נמצאו מוזמנים</li>
        ) : null}
        {filteredGuests.map((guest) => (
          <li key={guest._id} className="il-hostess-card">
            <div className="il-hostess-card__info">
              <strong>{guest.fullName}</strong>
              <span dir="ltr">{guest.phone || "—"}</span>
              <span>
                {guest.tableLabel ? `שולחן ${guest.tableLabel}` : "ללא שולחן"} · {guest.status}
              </span>
            </div>
            <div className="il-hostess-card__actions">
              <button
                type="button"
                className="us-btn us-btn--primary"
                disabled={busyGuestId === guest._id}
                onClick={() => markArrived(guest)}
              >
                <UserCheck size={16} aria-hidden="true" />
                המוזמן הגיע
              </button>
              <button
                type="button"
                className="us-btn"
                disabled={busyGuestId === guest._id}
                onClick={() => sendTableWhatsApp(guest)}
              >
                <MessageCircle size={16} aria-hidden="true" />
                שלח מס׳ שולחן ב-WhatsApp
              </button>
            </div>
          </li>
        ))}
      </ul>

      {arriveModal ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setArriveModal(null)}>
          <div
            className="us-modal-card il-hostess-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>המוזמן הגיע</h2>
            <p>
              {arriveModal.tableLabel
                ? `${arriveModal.fullName} יושב/ת בשולחן ${arriveModal.tableLabel}`
                : arriveModal.message}
            </p>
            <button className="us-btn us-btn--primary" type="button" onClick={() => setArriveModal(null)}>
              סגור
            </button>
          </div>
        </div>
      ) : null}

      {lockedModal ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setLockedModal(false)}>
          <div
            className="us-modal-card il-hostess-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>הפיצ׳ר אינו פעיל</h2>
            <p>
              שליחת מספר שולחן ב-WhatsApp דורשת הפעלה ע״י מנהל המערכת ורכישת קופון מתאים.
            </p>
            <button className="us-btn us-btn--primary" type="button" onClick={() => setLockedModal(false)}>
              הבנתי
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
