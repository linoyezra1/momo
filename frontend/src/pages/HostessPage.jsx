import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, MessageCircle, Search, UserCheck, X } from "lucide-react";
import api from "../api";
import { MOMOEVENT_SUPPORT_PHONE } from "../utils/tableDispatchPurchase.js";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/hostess.css";

export default function HostessPage() {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventLabel, setEventLabel] = useState("");
  const [guests, setGuests] = useState([]);
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState("");
  const [canSendTableWhatsApp, setCanSendTableWhatsApp] = useState(false);
  const [arriveModal, setArriveModal] = useState(null);
  const [lockedModal, setLockedModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [busyGuestId, setBusyGuestId] = useState("");
  const [seatGuest, setSeatGuest] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [seatSuccess, setSeatSuccess] = useState(null);
  const [couponGuest, setCouponGuest] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");

  const loadHostess = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/hostess/${eventId}`);
      setEventLabel(data.eventLabel || "");
      setGuests(data.guests || []);
      setTables(data.tables || []);
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
    if (!toast?.autoDismiss) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.durationMs || 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message, { tone = "success", autoDismiss = true, durationMs = 3200 } = {}) => {
    setToast({ message, tone, autoDismiss, durationMs });
  };

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

  const availableTables = useMemo(() => {
    if (!seatGuest) return [];
    const needed = Math.max(1, Number(seatGuest.attendeesCount) || 1);
    return tables.filter((table) => Number(table.remaining) >= needed);
  }, [seatGuest, tables]);

  const markArrived = async (guest) => {
    setBusyGuestId(guest._id);
    const previous = { ...guest };
    setGuests((prev) =>
      prev.map((item) =>
        item._id === guest._id
          ? {
              ...item,
              status: "הגיע לאירוע",
              hostessArrivedAt: new Date().toISOString(),
              arrivalMarkedBy: "HOSTESS"
            }
          : item
      )
    );
    try {
      const { data } = await api.post(`/hostess/${eventId}/guests/${guest._id}/arrive`);
      setGuests((prev) =>
        prev.map((item) =>
          item._id === guest._id
            ? {
                ...item,
                ...(data.guest || {}),
                tableLabel: data.tableLabel || item.tableLabel,
                status: data.status || data.guest?.status || "הגיע לאירוע",
                arrivalMarkedBy: data.markedBy || "HOSTESS"
              }
            : item
        )
      );
      setArriveModal({
        fullName: guest.fullName,
        tableLabel: data.tableLabel || guest.tableLabel || "",
        message: data.message,
        guestId: guest._id
      });
    } catch (arriveError) {
      setGuests((prev) => prev.map((item) => (item._id === guest._id ? previous : item)));
      showToast(arriveError.response?.data?.message || "סימון הגעה נכשל", { tone: "error" });
    } finally {
      setBusyGuestId("");
    }
  };

  const openWhatsAppFlow = (guest) => {
    if (!canSendTableWhatsApp) {
      setLockedModal(true);
      return;
    }
    if (!guest.seatingTableId && !guest.tableLabel) {
      showToast("יש לשבץ את המוזמן לשולחן לפני שליחת מספר שולחן", { tone: "error" });
      return;
    }
    setCouponError("");
    setCouponCode("");
    setCouponGuest(guest);
  };

  const sendTableWhatsApp = async (guest, code) => {
    setBusyGuestId(guest._id);
    setCouponError("");
    try {
      const { data } = await api.post(`/hostess/${eventId}/guests/${guest._id}/send-table-whatsapp`, {
        paymentCode: code,
        couponCode: code
      });
      setCouponGuest(null);
      setCouponCode("");
      showToast(data.message || "נשלח בהצלחה! ✓", { tone: "success", durationMs: 4000 });
    } catch (sendError) {
      if (sendError.response?.data?.code === "feature_disabled") {
        setCouponGuest(null);
        setLockedModal(true);
      } else {
        setCouponError(sendError.response?.data?.message || "שליחת WhatsApp נכשלה");
      }
    } finally {
      setBusyGuestId("");
    }
  };

  const openSeatModal = (guest) => {
    setSelectedTableId("");
    setSeatGuest(guest);
  };

  const confirmSeatAtTable = async () => {
    if (!seatGuest || !selectedTableId) return;
    setBusyGuestId(seatGuest._id);
    try {
      const { data } = await api.post(`/hostess/${eventId}/guests/${seatGuest._id}/assign-table`, {
        tableId: selectedTableId
      });
      setGuests((prev) =>
        prev.map((item) =>
          item._id === seatGuest._id
            ? {
                ...item,
                ...(data.guest || {}),
                seatingTableId: selectedTableId,
                tableLabel: data.tableLabel || selectedTableId
              }
            : item
        )
      );
      if (Array.isArray(data.tables)) setTables(data.tables);
      setSeatGuest(null);
      setSeatSuccess({
        guestId: seatGuest._id,
        fullName: seatGuest.fullName,
        tableLabel: data.tableLabel || selectedTableId
      });
    } catch (assignError) {
      showToast(assignError.response?.data?.message || "שיבוץ לשולחן נכשל", { tone: "error" });
    } finally {
      setBusyGuestId("");
    }
  };

  return (
    <div className="il-hostess-page" dir="rtl" lang="he">
      <header className="il-hostess-header">
        <div>
          <p className="il-hostess-eyebrow">דיילת דיגיטלית</p>
          <h1>{eventLabel || "דיילת דיגיטלית"}</h1>
          <p>שימו מישהו מטעמכם על העמדה והוא מחפש את המוזמן ויודע איפה הוא יושב</p>
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
      {loading ? <p>טוען…</p> : null}

      <ul className="il-hostess-list">
        {!loading && !filteredGuests.length ? (
          <li className="il-hostess-empty">לא נמצאו מוזמנים</li>
        ) : null}
        {filteredGuests.map((guest) => {
          const arrived = guest.status === "הגיע לאירוע" || Boolean(guest.hostessArrivedAt);
          const isSeated = Boolean(guest.seatingTableId || guest.tableLabel);
          return (
            <li key={guest._id} className={`il-hostess-card${arrived ? " is-arrived" : ""}`}>
              <div className="il-hostess-card__info">
                <strong>{guest.fullName}</strong>
                <span dir="ltr">{guest.phone || "—"}</span>
                <span>
                  {guest.tableLabel ? `שולחן ${guest.tableLabel}` : "ללא שולחן"} · {guest.status}
                </span>
                {arrived ? (
                  <span className="il-hostess-arrived-badge">הגיע לאירוע · דיילת</span>
                ) : null}
              </div>
              <div className="il-hostess-card__actions">
                <button
                  type="button"
                  className="us-btn us-btn--primary"
                  disabled={busyGuestId === guest._id}
                  onClick={() => markArrived(guest)}
                >
                  <UserCheck size={16} aria-hidden="true" />
                  {arrived ? "עדכון הגעה" : "המוזמן הגיע"}
                </button>
                {!isSeated ? (
                  <button
                    type="button"
                    className="us-btn"
                    disabled={busyGuestId === guest._id}
                    onClick={() => openSeatModal(guest)}
                  >
                    הושבה בשולחן ריק
                  </button>
                ) : null}
                <button
                  type="button"
                  className="us-btn"
                  disabled={busyGuestId === guest._id}
                  onClick={() => openWhatsAppFlow(guest)}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  שלח מס׳ שולחן ב-WhatsApp
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {toast ? (
        <div
          className={`il-hostess-toast-popup il-hostess-toast-popup--${toast.tone} il-hostess-toast-popup--right`}
          role="status"
          aria-live="polite"
        >
          {toast.tone === "success" ? <Check size={18} aria-hidden="true" /> : null}
          <span>{toast.message}</span>
          <button
            type="button"
            className="il-hostess-toast-popup__close"
            aria-label="סגירה"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

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
            <p className="il-hostess-modal__meta">סטטוס עודכן ל־הגיע לאירוע · סומן על ידי דיילת אירוע</p>
            <button className="us-btn us-btn--primary" type="button" onClick={() => setArriveModal(null)}>
              סגור
            </button>
          </div>
        </div>
      ) : null}

      {seatGuest ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setSeatGuest(null)}>
          <div
            className="us-modal-card il-hostess-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>הושבה בשולחן ריק</h2>
            <p>
              בחרו שולחן פנוי עבור <strong>{seatGuest.fullName}</strong>
            </p>
            {!availableTables.length ? (
              <p className="us-error-message">אין כרגע שולחנות עם מקומות פנויים מספיק</p>
            ) : (
              <label className="us-admin-field-label" style={{ display: "block", marginBottom: "0.85rem" }}>
                שולחן
                <select
                  className="us-admin-field-input"
                  value={selectedTableId}
                  onChange={(event) => setSelectedTableId(event.target.value)}
                >
                  <option value="">בחרו שולחן…</option>
                  {availableTables.map((table) => (
                    <option key={table.tableId} value={table.tableId}>
                      שולחן {table.label} · פנויים {table.remaining}/{table.capacity}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="us-modal-actions">
              <button
                className="us-btn us-btn--primary"
                type="button"
                disabled={!selectedTableId || busyGuestId === seatGuest._id}
                onClick={confirmSeatAtTable}
              >
                הוסף לשולחן
              </button>
              <button className="us-btn" type="button" onClick={() => setSeatGuest(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {seatSuccess ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setSeatSuccess(null)}>
          <div
            className="us-modal-card il-hostess-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>שובץ בהצלחה</h2>
            <p>
              {seatSuccess.fullName} שובץ/ה לשולחן <strong>{seatSuccess.tableLabel}</strong>
            </p>
            <div className="us-modal-actions">
              <button
                className="us-btn us-btn--primary"
                type="button"
                onClick={() => {
                  const guest = guests.find((item) => item._id === seatSuccess.guestId) || {
                    _id: seatSuccess.guestId,
                    fullName: seatSuccess.fullName,
                    tableLabel: seatSuccess.tableLabel,
                    seatingTableId: "assigned"
                  };
                  setSeatSuccess(null);
                  openWhatsAppFlow(guest);
                }}
              >
                שלח לו בוואטסאפ
              </button>
              <button className="us-btn" type="button" onClick={() => setSeatSuccess(null)}>
                סגירה
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {couponGuest ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setCouponGuest(null)}>
          <form
            className="us-modal-card il-hostess-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!couponCode.trim()) {
                setCouponError("יש להזין קוד קופון לרכישה זו");
                return;
              }
              sendTableWhatsApp(couponGuest, couponCode.trim());
            }}
          >
            <h2>שליחת מספר שולחן</h2>
            <p>יש להזין קוד קופון פעיל לשליחת ההודעה.</p>
            <label className="us-admin-field-label" style={{ display: "block", marginBottom: "0.75rem" }}>
              קוד קופון
              <input
                className="us-admin-field-input"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="קוד קופון"
                autoComplete="off"
                required
              />
            </label>
            {couponError ? <p className="us-error-message">{couponError}</p> : null}
            <div className="us-modal-actions">
              <button className="us-btn us-btn--primary" type="submit" disabled={busyGuestId === couponGuest._id}>
                שליחה
              </button>
              <button className="us-btn" type="button" onClick={() => setCouponGuest(null)}>
                ביטול
              </button>
            </div>
          </form>
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
            <h2>שירות בתשלום</h2>
            <p>
              השירות כרוך בעלות נוספת, יש לפנות לתמיכה בטלפון{" "}
              <a href={`tel:${MOMOEVENT_SUPPORT_PHONE}`} dir="ltr">
                {MOMOEVENT_SUPPORT_PHONE}
              </a>
            </p>
            <button className="us-btn us-btn--primary" type="button" onClick={() => setLockedModal(false)}>
              סגור
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
