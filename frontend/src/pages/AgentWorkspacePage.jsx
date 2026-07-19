import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, ChevronDown, Clock3, MapPin, Phone, Users } from "lucide-react";
import api from "../api";
import AgentPhoneRsvpForm from "../components/AgentPhoneRsvpForm.jsx";
import { formatIsraeliDate } from "../utils/dateFormat.js";
import "../agent-workspace.css";

const CALL_OUTCOME_FILTER_OPTIONS = [
  { value: "all", label: "הכל" },
  { value: "answered", label: "ענה" },
  { value: "no_answer", label: "לא ענה" }
];

const RSVP_STATUS_FILTER_OPTIONS = [
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" },
  { value: "לא ידוע", label: "לא ידוע" }
];

const ATTEMPTS_FILTER_OPTIONS = [
  { value: "all", label: "כל מספר שיחות" },
  { value: "exact:0", label: "טרם התקשרו (0)" },
  { value: "exact:1", label: "בדיוק שיחה אחת" },
  { value: "exact:2", label: "בדיוק 2 שיחות" },
  { value: "exact:3", label: "בדיוק 3 שיחות" },
  { value: "gte:2", label: "2 שיחות ומעלה" },
  { value: "gte:3", label: "3 שיחות ומעלה" }
];

function matchesCallOutcomeFilter(guest, outcomeFilter) {
  if (outcomeFilter === "all") return true;
  if (outcomeFilter === "answered") return guest.callStatus === "answered";
  return guest.callStatus === "no_answer" || guest.callStatus === "disconnected";
}

function matchesAttemptsFilter(guest, attemptsFilter) {
  if (attemptsFilter === "all") return true;
  const attempts = Math.max(0, Number(guest.phoneAttemptsCount || 0));
  const [operator, rawValue] = attemptsFilter.split(":");
  const value = Number(rawValue);
  if (operator === "exact") return attempts === value;
  if (operator === "gte") return attempts >= value;
  return true;
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

export default function AgentWorkspacePage() {
  const { userId } = useParams();
  const [eventLabel, setEventLabel] = useState("");
  const [eventInfo, setEventInfo] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedGuestId, setExpandedGuestId] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [rsvpStatusFilters, setRsvpStatusFilters] = useState([]);
  const [attemptsFilter, setAttemptsFilter] = useState("all");
  const [selectedGuestIds, setSelectedGuestIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const loadGuests = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/agent/${userId}/guests`);
      setEventLabel(response.data?.eventLabel || "");
      setEventInfo(response.data?.event || null);
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

  const filteredGuests = useMemo(
    () =>
      guests.filter(
        (guest) =>
          matchesCallOutcomeFilter(guest, outcomeFilter) &&
          (!rsvpStatusFilters.length || rsvpStatusFilters.includes(guest.status)) &&
          matchesAttemptsFilter(guest, attemptsFilter)
      ),
    [guests, outcomeFilter, rsvpStatusFilters, attemptsFilter]
  );

  const toggleRsvpStatusFilter = (status) => {
    setRsvpStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    );
  };

  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((guest) => selectedGuestIds.has(guest._id));

  const exportTargets = useMemo(() => {
    const selectedInFilter = filteredGuests.filter((guest) => selectedGuestIds.has(guest._id));
    if (selectedInFilter.length) return selectedInFilter;
    return filteredGuests;
  }, [filteredGuests, selectedGuestIds]);

  const onGuestSaved = (updatedGuest) => {
    setGuests((prev) => prev.map((guest) => (guest._id === updatedGuest._id ? updatedGuest : guest)));
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
            </div>

            <div className="agent-filters">
              <fieldset className="agent-filters__group agent-filters__checks">
                <legend className="agent-field-label">סטטוס הגעה:</legend>
                <div className="agent-filter-checkboxes">
                  {RSVP_STATUS_FILTER_OPTIONS.map((option) => (
                    <label key={option.value} className="agent-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={rsvpStatusFilters.includes(option.value)}
                        onChange={() => toggleRsvpStatusFilter(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="agent-filters__group">
                <label className="agent-field-label" htmlFor="agent-outcome-filter">
                  תוצאת שיחה:
                </label>
                <select
                  id="agent-outcome-filter"
                  className="agent-field-input agent-filters__select"
                  value={outcomeFilter}
                  onChange={(event) => setOutcomeFilter(event.target.value)}
                >
                  {CALL_OUTCOME_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="agent-filters__group">
                <label className="agent-field-label" htmlFor="agent-attempts-filter">
                  מספר ניסיונות:
                </label>
                <select
                  id="agent-attempts-filter"
                  className="agent-field-input agent-filters__select"
                  value={attemptsFilter}
                  onChange={(event) => setAttemptsFilter(event.target.value)}
                >
                  {ATTEMPTS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="agent-filters__summary">
                מוצגים <strong>{filteredGuests.length}</strong> מתוך {guests.length} מוזמנים
                {selectedGuestIds.size ? (
                  <>
                    {" "}
                    · נבחרו <strong>{exportTargets.length}</strong> לייצוא
                  </>
                ) : (
                  <> · ייוצאו כל המוצגים</>
                )}
              </p>
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
                  <td colSpan={8} className="agent-table-empty">
                    לא נמצאו מוזמנים לסינון הנוכחי
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
                          className="agent-quick-action agent-quick-action--phone"
                          href={`tel:${guest.phone}`}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`חיוג אל ${guest.fullName}`}
                          title={`חיוג אל ${guest.fullName}`}
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
                        <td colSpan={8}>
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
