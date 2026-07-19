import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, ChevronDown, Clock3, MapPin, MessageCircle, Phone, Users } from "lucide-react";
import api from "../api";
import AgentPhoneRsvpForm from "../components/AgentPhoneRsvpForm.jsx";
import { formatIsraeliDate } from "../utils/dateFormat.js";
import { toInternationalWhatsAppPhone } from "../utils/whatsapp.js";
import "../agent-workspace.css";

function getWhatsAppRoundCount(guest) {
  return Math.max(
    0,
    Number(guest?.whatsappRoundsSentCount || 0),
    Number(guest?.reminderRound || 0)
  );
}

function whatsappRoundLabel(guest) {
  const round = getWhatsAppRoundCount(guest);
  if (!round) return "טרם נשלח";
  return `סבב ${round}`;
}

function callOutcomeLabel(callStatus) {
  if (callStatus === "answered") return "ענה";
  if (callStatus === "no_answer") return "לא ענה";
  if (callStatus === "disconnected") return "מנותק";
  return "טרם בוצעה שיחה";
}

function buildExportFileName(eventLabel) {
  const safeLabel = String(eventLabel || "guests")
    .replace(/[^\w\u0590-\u05FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `ייצוא-שיחות-${safeLabel || "guests"}-${stamp}.xlsx`;
}

function buildEventHosts(event) {
  if (!event) return "—";
  if (event.eventType === "חתונה") {
    return [event.brideName, event.groomName].filter(Boolean).join(" & ") || "—";
  }
  if (event.eventType === "ברית") {
    return [event.parentName1, event.parentName2].filter(Boolean).join(" & ") || "—";
  }
  return event.batMitzvahName || event.eventNames || event.parentName1 || "—";
}

function buildManualWhatsAppUrl({ guest, event, userId }) {
  const phone = toInternationalWhatsAppPhone(guest?.phone);
  if (!phone || !event || !userId) return "";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const guestRsvpLink = `${origin}/event/${userId}?guest=${encodeURIComponent(guest._id)}`;
  const message = [
    "✨ 🥂 ✨",
    `שלום ${guest.fullName || "אורח/ת יקר/ה"},`,
    "",
    "משפחה וחברים יקרים, הנכם מוזמנים לחתונה שלנו",
    "",
    `האירוע יתקיים ב-${formatIsraeliDate(event.eventDate)} בגן האירועים "${event.venueName || ""}"`,
    "",
    "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:",
    guestRsvpLink,
    "",
    `אוהבים ${event.brideName || ""} ו${event.groomName || ""}`,
    "",
    "✨ 🎉 ✨"
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function AgentWorkspacePage() {
  const { userId } = useParams();
  const [eventLabel, setEventLabel] = useState("");
  const [eventInfo, setEventInfo] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedGuestId, setExpandedGuestId] = useState("");
  const [maxPhoneRounds, setMaxPhoneRounds] = useState(0);
  const [selectedGuestIds, setSelectedGuestIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [attemptsFilter, setAttemptsFilter] = useState("all");

  const loadGuests = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/agent/${userId}/guests`);
      setEventLabel(response.data?.eventLabel || "");
      setEventInfo(response.data?.event || null);
      setMaxPhoneRounds(Number(response.data?.maxPhoneRounds) || 0);
      setGuests(response.data?.guests || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מוזמנים נכשלה");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuests();
  }, [userId]);

  const filteredGuests = useMemo(() => {
    if (attemptsFilter === "all") return guests;
    const exactAttempts = Number(attemptsFilter);
    return guests.filter((guest) => Number(guest.phoneAttemptsCount || 0) === exactAttempts);
  }, [attemptsFilter, guests]);

  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((guest) => selectedGuestIds.has(guest._id));

  const exportTargets = useMemo(() => {
    const selectedInFilter = filteredGuests.filter((guest) => selectedGuestIds.has(guest._id));
    if (selectedInFilter.length) return selectedInFilter;
    return filteredGuests;
  }, [filteredGuests, selectedGuestIds]);

  const onGuestSaved = (updatedGuest, metadata = {}) => {
    setGuests((prev) =>
      metadata.removeFromQueue
        ? prev.filter((guest) => guest._id !== updatedGuest._id)
        : prev.map((guest) => (guest._id === updatedGuest._id ? updatedGuest : guest))
    );
    if (metadata.removeFromQueue) {
      setSelectedGuestIds((prev) => {
        const next = new Set(prev);
        next.delete(updatedGuest._id);
        return next;
      });
      setExpandedGuestId("");
    }
  };

  const toggleGuestSelection = (guestId) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredGuests.forEach((guest) => next.delete(guest._id));
      } else {
        filteredGuests.forEach((guest) => next.add(guest._id));
      }
      return next;
    });
  };

  const exportToExcel = async () => {
    if (!exportTargets.length) return;

    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = exportTargets.map((guest) => ({
        "שם מלא": guest.fullName,
        טלפון: guest.phone,
        "סטטוס הגעה": guest.status,
        "תוצאת שיחה": callOutcomeLabel(guest.callStatus),
        "סבב וואטסאפ": whatsappRoundLabel(guest),
        "מספר ניסיונות שיחה": guest.phoneAttemptsCount || 0,
        "כמות מגיעים": guest.attendeesCount ?? 0,
        הערות: guest.agentNotes || ""
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "שיחות");
      XLSX.writeFile(workbook, buildExportFileName(eventLabel));
    } finally {
      setExporting(false);
    }
  };

  const eventAddress = [eventInfo?.streetAndNumber, eventInfo?.city].filter(Boolean).join(", ");
  const eventStartTime = eventInfo?.receptionTime || eventInfo?.eventTime || "";

  return (
    <div className="agent-shell" dir="rtl">
      <div className="agent-container agent-container--wide">
        <header className="agent-header agent-header--workspace">
          <div>
            <Link className="agent-back-link" to="/agent">
              ← חזרה לרשימת אירועים
            </Link>
            <h1>{eventLabel || "מרחב נציג טלפוני"}</h1>
            <p>{guests.length} מוזמנים ברשימה</p>
          </div>
        </header>

        {loading ? <p className="agent-muted">טוען מוזמנים…</p> : null}
        {error ? <p className="agent-error">{error}</p> : null}

        {!loading && eventInfo ? (
          <section className="agent-quick-info" aria-labelledby="agent-quick-info-title">
            <div className="agent-quick-info__heading">
              <span>מידע מהיר לשיחה</span>
              <h2 id="agent-quick-info-title">{eventLabel || "פרטי האירוע"}</h2>
            </div>
            <div className="agent-quick-info__grid">
              <div className="agent-quick-info__item">
                <Users size={19} aria-hidden="true" />
                <div>
                  <span>הזוג</span>
                  <strong>{buildEventHosts(eventInfo)}</strong>
                </div>
              </div>
              <div className="agent-quick-info__item">
                <CalendarDays size={19} aria-hidden="true" />
                <div>
                  <span>תאריך</span>
                  <strong>{formatIsraeliDate(eventInfo.eventDate) || "—"}</strong>
                </div>
              </div>
              <div className="agent-quick-info__item">
                <MapPin size={19} aria-hidden="true" />
                <div>
                  <span>אולם / מיקום</span>
                  <strong>{eventInfo.venueName || "—"}</strong>
                </div>
              </div>
              <div className="agent-quick-info__item">
                <Clock3 size={19} aria-hidden="true" />
                <div>
                  <span>שעת התחלה</span>
                  <strong>{eventStartTime || "—"}</strong>
                </div>
              </div>
              <div className="agent-quick-info__item agent-quick-info__item--wide">
                <MapPin size={19} aria-hidden="true" />
                <div>
                  <span>כתובת</span>
                  <strong>{eventAddress || "—"}</strong>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading ? (
          <>
            <div className="agent-toolbar">
              <button
                className="agent-btn agent-btn--primary"
                type="button"
                onClick={exportToExcel}
                disabled={exporting || !exportTargets.length}
              >
                {exporting ? "מייצא…" : "ייצוא לאקסל עבור שיחות"}
              </button>
              <label className="agent-select-all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  disabled={!filteredGuests.length}
                />
                בחירת כל המוצגים ({filteredGuests.length})
              </label>
              <label className="agent-attempts-filter">
                <span>סינון לפי ניסיונות שיחה</span>
                <select value={attemptsFilter} onChange={(event) => setAttemptsFilter(event.target.value)}>
                  <option value="all">כל הניסיונות</option>
                  <option value="0">טרם בוצעה שיחה</option>
                  {Array.from({ length: maxPhoneRounds }, (_, index) => index + 1).map((attempt) => (
                    <option key={attempt} value={attempt}>
                      {attempt === 1 ? "ניסיון אחד" : `${attempt} ניסיונות`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="agent-auto-queue" role="status">
              <div>
                <strong>תור שיחות אוטומטי</strong>
                <span>
                  מוצגים רק מוזמנים שקיבלו וואטסאפ, טרם אישרו הגעה ולא הגיעו למכסת השיחות.
                </span>
              </div>
              <div className="agent-auto-queue__stats">
                <span>
                  מוצגים: <strong>{filteredGuests.length}</strong> מתוך {guests.length}
                </span>
                <span>
                  מכסה: <strong>{maxPhoneRounds}</strong> ניסיונות
                </span>
                {selectedGuestIds.size ? (
                  <span>
                    נבחרו: <strong>{exportTargets.length}</strong>
                  </span>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div className="agent-table-wrap">
          <table className="agent-guests-table">
            <thead>
              <tr>
                <th className="agent-table-check">
                  <span className="agent-sr-only">בחירה</span>
                </th>
                <th>שם</th>
                <th>טלפון</th>
                <th>סטטוס הגעה</th>
                <th>סבב וואטסאפ</th>
                <th>תוצאת שיחה</th>
                <th>ניסיונות</th>
                <th className="agent-table-actions">פעולות</th>
                <th className="agent-table-expand">
                  <span className="agent-sr-only">פתיחת עריכה</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && !filteredGuests.length ? (
                <tr>
                  <td colSpan={9} className="agent-table-empty">
                    {guests.length
                      ? "לא נמצאו מוזמנים עם מספר ניסיונות השיחה שנבחר"
                      : "אין כרגע מוזמנים שממתינים לשיחה לפי תנאי החבילה"}
                  </td>
                </tr>
              ) : null}

              {filteredGuests.map((guest) => {
                const isExpanded = expandedGuestId === guest._id;
                const isSelected = selectedGuestIds.has(guest._id);
                const toggleExpanded = () => setExpandedGuestId(isExpanded ? "" : guest._id);
                return (
                  <Fragment key={guest._id}>
                    <tr
                      className={`agent-table-main-row${isExpanded ? " is-expanded" : ""}${
                        isSelected ? " is-selected" : ""
                      }`}
                      onClick={toggleExpanded}
                      aria-expanded={isExpanded}
                    >
                      <td
                        className="agent-table-check"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleGuestSelection(guest._id)}
                          aria-label={`בחירת ${guest.fullName}`}
                        />
                      </td>
                      <td data-label="שם">
                        <strong>{guest.fullName}</strong>
                      </td>
                      <td data-label="טלפון" dir="ltr">
                        <a
                          href={`tel:${guest.phone}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {guest.phone}
                        </a>
                      </td>
                      <td data-label="סטטוס הגעה">
                        <span className="agent-pill">{guest.status}</span>
                      </td>
                      <td data-label="סבב וואטסאפ">
                        <span
                          className={`agent-whatsapp-round-badge${
                            getWhatsAppRoundCount(guest) === 0 ? " is-none" : ""
                          }`}
                        >
                          {whatsappRoundLabel(guest)}
                        </span>
                      </td>
                      <td data-label="תוצאת שיחה">
                        <span
                          className={`agent-pill${
                            guest.callStatus === "answered"
                              ? " agent-pill--answered"
                              : guest.callStatus
                                ? " agent-pill--muted"
                                : ""
                          }`}
                        >
                          {callOutcomeLabel(guest.callStatus)}
                        </span>
                      </td>
                      <td data-label="ניסיונות">
                        <span className="agent-attempts-count">
                          {guest.phoneAttemptsCount || 0}
                        </span>
                      </td>
                      <td className="agent-table-actions" data-label="פעולות">
                        <a
                          className="agent-quick-action agent-quick-action--whatsapp"
                          href={buildManualWhatsAppUrl({ guest, event: eventInfo, userId }) || undefined}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`שלח הזמנה ידנית בווצאפ אל ${guest.fullName}`}
                          title="שלח הזמנה ידנית בווצאפ"
                        >
                          <MessageCircle size={18} aria-hidden="true" />
                        </a>
                        <a
                          className={`agent-quick-action agent-quick-action--phone${
                            getWhatsAppRoundCount(guest) === 0 ? " is-unready" : ""
                          }`}
                          href={`tel:${guest.phone}`}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`חיוג אל ${guest.fullName}`}
                          title={
                            getWhatsAppRoundCount(guest) === 0
                              ? "אזהרה: טרם נשלח וואטסאפ למוזמן"
                              : `חיוג אל ${guest.fullName}`
                          }
                        >
                          <Phone size={18} aria-hidden="true" />
                        </a>
                      </td>
                      <td className="agent-table-expand">
                        <button
                          type="button"
                          className="agent-row-expand-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded();
                          }}
                          aria-label={`${isExpanded ? "סגירת" : "פתיחת"} עריכת ${guest.fullName}`}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown size={18} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="agent-table-detail-row">
                        <td colSpan={9}>
                          <div className="agent-table-detail-content">
                            <AgentPhoneRsvpForm
                              guest={guest}
                              userId={userId}
                              onSaved={onGuestSaved}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
