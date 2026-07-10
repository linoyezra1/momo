import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import AgentPhoneRsvpForm from "../components/AgentPhoneRsvpForm.jsx";
import "../agent-workspace.css";

const AGENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "הכל" },
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" },
  { value: "no_answer", label: "לא ענו" }
];

function matchesAgentStatusFilter(guest, statusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "no_answer") return guest.callStatus === "no_answer";
  return guest.status === statusFilter;
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

export default function AgentWorkspacePage() {
  const { userId } = useParams();
  const [eventLabel, setEventLabel] = useState("");
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedGuestId, setExpandedGuestId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGuestIds, setSelectedGuestIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const loadGuests = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/agent/${userId}/guests`);
      setEventLabel(response.data?.eventLabel || "");
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
    () => guests.filter((guest) => matchesAgentStatusFilter(guest, statusFilter)),
    [guests, statusFilter]
  );

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
        "כמות מגיעים": guest.attendeesCount ?? 0
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "שיחות");
      XLSX.writeFile(workbook, buildExportFileName(eventLabel));
    } finally {
      setExporting(false);
    }
  };

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
              <div className="agent-filters__group">
                <label className="agent-field-label" htmlFor="agent-status-filter">
                  סינון לפי סטטוס:
                </label>
                <select
                  id="agent-status-filter"
                  className="agent-field-input agent-filters__select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  {AGENT_STATUS_FILTER_OPTIONS.map((option) => (
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

        <div className="agent-guest-list">
          {!loading && !filteredGuests.length ? (
            <p className="agent-muted">לא נמצאו מוזמנים לסינון הנוכחי</p>
          ) : null}

          {filteredGuests.map((guest) => {
            const isExpanded = expandedGuestId === guest._id;
            const isSelected = selectedGuestIds.has(guest._id);
            return (
              <article
                key={guest._id}
                className={`agent-guest-card${isExpanded ? " is-expanded" : ""}${isSelected ? " is-selected" : ""}`}
              >
                <div className="agent-guest-card__summary">
                  <label className="agent-guest-card__check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGuestSelection(guest._id)}
                      aria-label={`בחירת ${guest.fullName}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="agent-guest-card__toggle"
                    onClick={() => setExpandedGuestId(isExpanded ? "" : guest._id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="agent-guest-card__main">
                      <strong>{guest.fullName}</strong>
                      <span dir="ltr">{guest.phone}</span>
                    </div>
                    <div className="agent-guest-card__meta">
                      <span className="agent-pill">סטטוס: {guest.status}</span>
                      {guest.callStatus === "no_answer" ? (
                        <span className="agent-pill agent-pill--muted">לא ענה</span>
                      ) : null}
                      {guest.confirmationMethod === "phone" && guest.callTimestamp ? (
                        <span className="agent-pill agent-pill--phone">טלפוני</span>
                      ) : null}
                      <span className="agent-guest-card__chevron" aria-hidden="true">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>
                </div>

                {isExpanded ? (
                  <div className="agent-guest-card__body">
                    <AgentPhoneRsvpForm guest={guest} userId={userId} onSaved={onGuestSaved} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
