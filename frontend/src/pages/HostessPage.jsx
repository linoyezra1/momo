import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Armchair,
  Check,
  CircleCheck,
  MapPin,
  Plus,
  Search,
  Send,
  Users,
  X
} from "lucide-react";
import api from "../api";
import TableDispatchFeatureLockedNotice from "../components/TableDispatchFeatureLockedNotice.jsx";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/hostess.css";

function statusTagClass(status) {
  if (status === "מגיע") return "il-hostess-tag--status-yes";
  if (status === "אולי") return "il-hostess-tag--status-maybe";
  if (status === "הגיע לאירוע") return "il-hostess-tag--status-arrived";
  return "il-hostess-tag--status-default";
}

function isGuestArrived(guest) {
  return guest.status === "הגיע לאירוע" || Boolean(guest.hostessArrivedAt);
}

function guestHasPhone(guest) {
  return Boolean(String(guest?.phone || "").trim());
}

const emptyAddGuestForm = {
  fullName: "",
  phone: "",
  attendeesCount: 1
};

export default function HostessPage() {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventLabel, setEventLabel] = useState("");
  const [eventInfo, setEventInfo] = useState(null);
  const [guests, setGuests] = useState([]);
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState("");
  const [canSendTableWhatsApp, setCanSendTableWhatsApp] = useState(false);
  const [arriveModal, setArriveModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [busyGuestId, setBusyGuestId] = useState("");
  const [seatGuest, setSeatGuest] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [seatSuccess, setSeatSuccess] = useState(null);
  const [couponGuest, setCouponGuest] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [addGuestForm, setAddGuestForm] = useState(emptyAddGuestForm);
  const [addGuestError, setAddGuestError] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);

  const loadHostess = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/hostess/${eventId}`);
      setEventLabel(data.eventLabel || "");
      setEventInfo(data.event || null);
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

  const arrivedCount = useMemo(
    () => guests.filter((guest) => isGuestArrived(guest)).length,
    [guests]
  );

  const seatNeeded = Math.max(1, Number(seatGuest?.attendeesCount) || 1);

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
        guestId: guest._id,
        phone: guest.phone || data.guest?.phone || "",
        seatingTableId: data.guest?.seatingTableId || guest.seatingTableId || ""
      });
    } catch (arriveError) {
      setGuests((prev) => prev.map((item) => (item._id === guest._id ? previous : item)));
      showToast(arriveError.response?.data?.message || "סימון הגעה נכשל", { tone: "error" });
    } finally {
      setBusyGuestId("");
    }
  };

  const openWhatsAppFlow = (guest) => {
    if (!canSendTableWhatsApp) return;
    if (!guestHasPhone(guest)) {
      showToast("למוזמן אין מספר טלפון — לא ניתן לשלוח WhatsApp", { tone: "error" });
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

  const openAddGuestModal = () => {
    setAddGuestForm(emptyAddGuestForm);
    setAddGuestError("");
    setAddGuestOpen(true);
  };

  const closeAddGuestModal = () => {
    if (addingGuest) return;
    setAddGuestOpen(false);
    setAddGuestError("");
  };

  const submitAddGuest = async (submitEvent) => {
    submitEvent.preventDefault();
    const fullName = String(addGuestForm.fullName || "").trim();
    if (!fullName) {
      setAddGuestError("יש להזין שם מלא");
      return;
    }
    setAddingGuest(true);
    setAddGuestError("");
    try {
      const { data } = await api.post(`/hostess/${eventId}/guests`, {
        fullName,
        phone: String(addGuestForm.phone || "").trim(),
        attendeesCount: Math.max(1, Number(addGuestForm.attendeesCount) || 1)
      });
      const created = data.guest;
      if (created) {
        setGuests((prev) =>
          [...prev, created].sort((a, b) =>
            String(a.fullName || "").localeCompare(String(b.fullName || ""), "he")
          )
        );
      }
      if (Array.isArray(data.tables)) setTables(data.tables);
      setAddGuestOpen(false);
      setAddGuestForm(emptyAddGuestForm);
      showToast(data.message || "המוזמן נוסף בהצלחה", { tone: "success" });
      if (created && !created.seatingTableId) {
        setSelectedTableId("");
        setSeatGuest(created);
      }
    } catch (addError) {
      setAddGuestError(addError.response?.data?.message || "הוספת מוזמן נכשלה");
    } finally {
      setAddingGuest(false);
    }
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
        setCanSendTableWhatsApp(false);
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

  const closeSeatModal = () => {
    setSeatGuest(null);
    setSelectedTableId("");
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
      setSelectedTableId("");
      setSeatSuccess({
        guestId: seatGuest._id,
        fullName: seatGuest.fullName,
        tableLabel: data.tableLabel || selectedTableId,
        phone: seatGuest.phone || ""
      });
    } catch (assignError) {
      showToast(assignError.response?.data?.message || "שיבוץ לשולחן נכשל", { tone: "error" });
    } finally {
      setBusyGuestId("");
    }
  };

  return (
    <div className="il-hostess-page" dir="rtl" lang="he">
      <div className="il-hostess-shell">
        <header className="il-hostess-header">
          <div className="il-hostess-header__inner">
            <div className="il-hostess-header__top">
              <div>
                <p className="il-hostess-eyebrow">שלום, דיילת</p>
                <h1>קבלת פנים · {eventLabel || "דיילת דיגיטלית"}</h1>
              </div>
              <div className="il-hostess-arrived-count" aria-label={`${arrivedCount} הגיעו`}>
                <span className="il-hostess-arrived-count__num">{arrivedCount}</span>
                <span className="il-hostess-arrived-count__label">הגיעו</span>
              </div>
            </div>

            <label className="il-hostess-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חיפוש לפי שם או טלפון..."
                autoFocus
                aria-label="חיפוש מוזמנים"
              />
              {query ? (
                <button
                  type="button"
                  className="il-hostess-search__clear"
                  aria-label="נקה חיפוש"
                  onClick={() => setQuery("")}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </label>
          </div>
        </header>

        <div className="il-hostess-body">
          {error ? <p className="il-hostess-status-line il-hostess-status-line--error">{error}</p> : null}
          {loading ? <p className="il-hostess-status-line">טוען…</p> : null}
          {!loading && !canSendTableWhatsApp ? (
            <TableDispatchFeatureLockedNotice
              event={eventInfo}
              eventLabel={eventLabel}
              eventId={eventId}
              className="il-hostess-wa-locked"
            />
          ) : null}

          <div className="il-hostess-toolbar">
            <button type="button" className="il-hostess-btn il-hostess-btn--secondary" onClick={openAddGuestModal}>
              <Plus size={14} aria-hidden="true" />
              הוסף מוזמן שלא אישר הגעה
            </button>
          </div>

          <ul className="il-hostess-list">
            {!loading && !filteredGuests.length ? (
              <li className="il-hostess-empty">לא נמצאו מוזמנים</li>
            ) : null}
            {filteredGuests.map((guest) => {
              const arrived = isGuestArrived(guest);
              const isSeated = Boolean(guest.seatingTableId || guest.tableLabel);
              return (
                <li key={guest._id} className={`il-hostess-card${arrived ? " is-arrived" : ""}`}>
                  <div className="il-hostess-card__info">
                    <div className="il-hostess-card__name-row">
                      <h2 className="il-hostess-card__name">{guest.fullName}</h2>
                      {arrived ? (
                        <span className="il-hostess-arrived-badge">
                          <CircleCheck size={12} aria-hidden="true" />
                          הגיע
                        </span>
                      ) : null}
                    </div>
                    <span className="il-hostess-card__phone" dir="ltr">
                      {guest.phone || "—"}
                    </span>
                    <div className="il-hostess-card__tags">
                      <span className={`il-hostess-tag ${isSeated ? "il-hostess-tag--table" : "il-hostess-tag--no-table"}`}>
                        <Armchair size={12} aria-hidden="true" />
                        {guest.tableLabel ? `שולחן ${guest.tableLabel}` : "ללא שולחן"}
                      </span>
                      <span className={`il-hostess-tag ${statusTagClass(guest.status)}`}>
                        {guest.status || "לא ידוע"}
                      </span>
                    </div>
                  </div>
                  <div className="il-hostess-card__actions">
                    <button
                      type="button"
                      className={`il-hostess-btn ${arrived ? "il-hostess-btn--outline" : "il-hostess-btn--primary"}`}
                      disabled={busyGuestId === guest._id}
                      onClick={() => markArrived(guest)}
                    >
                      <Check size={14} aria-hidden="true" />
                      {arrived ? "עדכון הגעה" : "המוזמן הגיע"}
                    </button>
                    {!isSeated ? (
                      <button
                        type="button"
                        className="il-hostess-btn il-hostess-btn--secondary"
                        disabled={busyGuestId === guest._id}
                        onClick={() => openSeatModal(guest)}
                      >
                        <Armchair size={14} aria-hidden="true" />
                        הושבה בשולחן ריק
                      </button>
                    ) : null}
                    {canSendTableWhatsApp && guestHasPhone(guest) ? (
                      <button
                        type="button"
                        className="il-hostess-btn il-hostess-btn--ghost"
                        disabled={busyGuestId === guest._id}
                        onClick={() => openWhatsAppFlow(guest)}
                      >
                        <Send size={14} aria-hidden="true" />
                        שלח מס׳ שולחן ב-WhatsApp
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {toast ? (
        <div
          className={`il-hostess-toast-popup il-hostess-toast-popup--${toast.tone}`}
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
            className="us-modal-card il-hostess-modal il-hostess-modal--arrive"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>המוזמן הגיע</h2>
            <p className="il-hostess-modal__lead">
              {arriveModal.tableLabel
                ? `${arriveModal.fullName} יושב/ת בשולחן ${arriveModal.tableLabel}`
                : arriveModal.message || `${arriveModal.fullName} עדיין לא משובץ/ת לשולחן`}
            </p>
            <div className="us-modal-actions il-hostess-modal__arrive-actions">
              {arriveModal.tableLabel || arriveModal.seatingTableId ? (
                <>
                  {canSendTableWhatsApp && guestHasPhone(arriveModal) ? (
                    <button
                      className="il-hostess-btn il-hostess-btn--primary"
                      type="button"
                      onClick={() => {
                        const guest = guests.find((item) => item._id === arriveModal.guestId) || {
                          _id: arriveModal.guestId,
                          fullName: arriveModal.fullName,
                          tableLabel: arriveModal.tableLabel,
                          seatingTableId: arriveModal.seatingTableId || "assigned",
                          phone: arriveModal.phone || ""
                        };
                        setArriveModal(null);
                        openWhatsAppFlow(guest);
                      }}
                    >
                      שלח לו מס׳ שולחן בוואטסאפ
                    </button>
                  ) : !canSendTableWhatsApp ? (
                    <TableDispatchFeatureLockedNotice
                      event={eventInfo}
                      eventLabel={eventLabel}
                      eventId={eventId}
                      className="il-hostess-wa-locked"
                    />
                  ) : null}
                </>
              ) : (
                <button
                  className="il-hostess-btn il-hostess-btn--primary"
                  type="button"
                  onClick={() => {
                    const guest = guests.find((item) => item._id === arriveModal.guestId) || {
                      _id: arriveModal.guestId,
                      fullName: arriveModal.fullName,
                      phone: arriveModal.phone || "",
                      attendeesCount: 1
                    };
                    setArriveModal(null);
                    openSeatModal(guest);
                  }}
                >
                  <Armchair size={16} aria-hidden="true" />
                  הושבה בשולחן
                </button>
              )}
              <button
                className="il-hostess-btn il-hostess-btn--outline"
                type="button"
                onClick={() => setArriveModal(null)}
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {seatGuest ? (
        <div className="us-modal-backdrop" role="presentation" onClick={closeSeatModal}>
          <div
            className="us-modal-card il-hostess-modal il-hostess-modal--seat"
            role="dialog"
            aria-modal="true"
            aria-label={`בחירת שולחן עבור ${seatGuest.fullName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="il-hostess-modal__head">
              <div>
                <h2>בחירת שולחן</h2>
                <p>
                  הושבת <strong>{seatGuest.fullName}</strong> בשולחן פנוי
                </p>
              </div>
              <button
                type="button"
                className="il-hostess-modal__close"
                aria-label="סגירה"
                onClick={closeSeatModal}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {!tables.length ? (
              <p className="il-hostess-status-line il-hostess-status-line--error" style={{ marginTop: "1rem" }}>
                אין שולחנות במערך ההושבה
              </p>
            ) : (
              <div className="il-hostess-table-grid">
                {tables.map((table) => {
                  const full = Number(table.remaining) < seatNeeded;
                  const selected = selectedTableId === table.tableId;
                  return (
                    <button
                      key={table.tableId}
                      type="button"
                      className={`il-hostess-table-cell${selected ? " is-selected" : ""}`}
                      disabled={full || busyGuestId === seatGuest._id}
                      aria-pressed={selected}
                      onClick={() => setSelectedTableId(table.tableId)}
                    >
                      <span className="il-hostess-table-cell__num">{table.label}</span>
                      <span className="il-hostess-table-cell__meta">
                        <Users size={12} aria-hidden="true" />
                        {full ? "מלא" : `${table.remaining} פנויים`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="il-hostess-table-hint">
              <MapPin size={14} aria-hidden="true" />
              בחרו שולחן ואז לחצו אישור לשיבוץ
            </p>

            <div className="us-modal-actions">
              <button
                className="il-hostess-btn il-hostess-btn--primary"
                type="button"
                disabled={!selectedTableId || busyGuestId === seatGuest._id}
                onClick={confirmSeatAtTable}
              >
                אישור שיבוץ
              </button>
              <button className="il-hostess-btn il-hostess-btn--outline" type="button" onClick={closeSeatModal}>
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
              {canSendTableWhatsApp && guestHasPhone(guests.find((item) => item._id === seatSuccess.guestId) || seatSuccess) ? (
                <button
                  className="il-hostess-btn il-hostess-btn--primary"
                  type="button"
                  onClick={() => {
                    const guest = guests.find((item) => item._id === seatSuccess.guestId) || {
                      _id: seatSuccess.guestId,
                      fullName: seatSuccess.fullName,
                      tableLabel: seatSuccess.tableLabel,
                      seatingTableId: "assigned",
                      phone: seatSuccess.phone || ""
                    };
                    setSeatSuccess(null);
                    openWhatsAppFlow(guest);
                  }}
                >
                  שלח לו בוואטסאפ
                </button>
              ) : !canSendTableWhatsApp ? (
                <TableDispatchFeatureLockedNotice
                  event={eventInfo}
                  eventLabel={eventLabel}
                  eventId={eventId}
                  className="il-hostess-wa-locked"
                />
              ) : null}
              <button
                className="il-hostess-btn il-hostess-btn--outline"
                type="button"
                onClick={() => setSeatSuccess(null)}
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {couponGuest && canSendTableWhatsApp ? (
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
            <label className="il-hostess-field">
              קוד קופון
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="קוד קופון"
                autoComplete="off"
                required
              />
            </label>
            {couponError ? (
              <p className="il-hostess-status-line il-hostess-status-line--error" style={{ marginTop: "0.75rem" }}>
                {couponError}
              </p>
            ) : null}
            <div className="us-modal-actions">
              <button
                className="il-hostess-btn il-hostess-btn--primary"
                type="submit"
                disabled={busyGuestId === couponGuest._id}
              >
                שליחה
              </button>
              <button
                className="il-hostess-btn il-hostess-btn--outline"
                type="button"
                onClick={() => setCouponGuest(null)}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {addGuestOpen ? (
        <div className="us-modal-backdrop" role="presentation" onClick={closeAddGuestModal}>
          <form
            className="us-modal-card il-hostess-modal"
            role="dialog"
            aria-modal="true"
            aria-label="הוספת מוזמן שלא אישר הגעה"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitAddGuest}
          >
            <div className="il-hostess-modal__head">
              <div>
                <h2>הוסף מוזמן שלא אישר הגעה</h2>
                <p>טלפון אופציונלי. הסטטוס יישמר כהגיע · לא היה ברשימת המוזמנים. אחרי ההוספה תוכלו לשבץ לשולחן פנוי.</p>
              </div>
              <button
                type="button"
                className="il-hostess-modal__close"
                aria-label="סגירה"
                onClick={closeAddGuestModal}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <label className="il-hostess-field">
              שם מלא
              <input
                value={addGuestForm.fullName}
                onChange={(event) =>
                  setAddGuestForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="שם המוזמן"
                autoComplete="name"
                required
                autoFocus
              />
            </label>

            <label className="il-hostess-field">
              טלפון (אופציונלי)
              <input
                value={addGuestForm.phone}
                onChange={(event) =>
                  setAddGuestForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="050-0000000"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
              />
            </label>

            <label className="il-hostess-field">
              כמות מגיעים
              <input
                type="number"
                min="1"
                max="20"
                value={addGuestForm.attendeesCount}
                onChange={(event) =>
                  setAddGuestForm((prev) => ({
                    ...prev,
                    attendeesCount: Math.max(1, Number(event.target.value) || 1)
                  }))
                }
                required
              />
            </label>

            {addGuestError ? (
              <p className="il-hostess-status-line il-hostess-status-line--error" style={{ marginTop: "0.75rem" }}>
                {addGuestError}
              </p>
            ) : null}

            <div className="us-modal-actions">
              <button className="il-hostess-btn il-hostess-btn--primary" type="submit" disabled={addingGuest}>
                {addingGuest ? "מוסיף…" : "הוספה"}
              </button>
              <button
                className="il-hostess-btn il-hostess-btn--outline"
                type="button"
                disabled={addingGuest}
                onClick={closeAddGuestModal}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
