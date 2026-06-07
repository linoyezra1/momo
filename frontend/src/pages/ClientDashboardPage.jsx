import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { RotateCw, Search } from "lucide-react";
import api from "../api";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { formatUsLongDate } from "../utils/usDateFormat";
import { buildUsWhatsAppSendUrl } from "../utils/usWhatsApp";
import UsInvitationEditor from "../us/components/UsInvitationEditor.jsx";
import "../us/client-portal.css";

const DIETARY_OPTIONS = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy"];

const STATUS_OPTIONS = [
  { value: "Joyfully Accepts", label: "Joyfully Accepts" },
  { value: "Regretfully Declines", label: "Regretfully Declines" }
];

const initialGuest = {
  fullName: "",
  email: "",
  phone: "",
  attendeesCount: 1,
  status: "Joyfully Accepts",
  dietaryRestrictions: [],
  dietaryNotes: ""
};

function getGuestRowClass(status) {
  if (status === "Joyfully Accepts") return "us-row-accepts";
  if (status === "Regretfully Declines") return "us-row-declines";
  return "";
}

function getDietaryBadgeClass(option) {
  if (option === "Vegan") return "us-dietary-badge--vegan";
  if (option === "Vegetarian") return "us-dietary-badge--vegetarian";
  if (option === "Gluten-Free") return "us-dietary-badge--gluten-free";
  if (option === "Nut Allergy") return "us-dietary-badge--nut-allergy";
  return "us-dietary-badge--none";
}

function getOwnerGreeting(event) {
  if (!event) return "Welcome";
  if (event.hostNames) {
    return `Welcome, ${event.hostNames}`;
  }
  return "Welcome";
}

function toggleDietary(current, option) {
  if (option === "None") {
    return current.includes("None") ? [] : ["None"];
  }
  const withoutNone = current.filter((item) => item !== "None");
  if (withoutNone.includes(option)) {
    return withoutNone.filter((item) => item !== option);
  }
  return [...withoutNone, option];
}

function renderDietaryBadges(restrictions) {
  const list = restrictions || [];
  if (!list.length) {
    return <span className="us-dietary-badge us-dietary-badge--none">None</span>;
  }
  return (
    <div className="us-dietary-badges">
      {list.map((option) => (
        <span key={option} className={`us-dietary-badge ${getDietaryBadgeClass(option)}`}>
          {option}
        </span>
      ))}
    </div>
  );
}

function sourceLabel(source) {
  if (source === "excel") return "Imported";
  if (source === "excel_and_form") return "Imported + RSVP";
  if (source === "form") return "Public RSVP";
  return "Manual";
}

export default function ClientDashboardPage() {
  const { userId } = useParams();
  const [summary, setSummary] = useState({
    totalInvited: 0,
    totalAttending: 0,
    totalDeclined: 0,
    dietaryAlerts: 0
  });
  const [importError, setImportError] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [importConflicts, setImportConflicts] = useState([]);
  const [conflictChoices, setConflictChoices] = useState({});
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importChecking, setImportChecking] = useState(false);
  const [pendingNewGuests, setPendingNewGuests] = useState([]);
  const [guests, setGuests] = useState([]);
  const [eventInfo, setEventInfo] = useState(null);
  const [eventSlug, setEventSlug] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [manualGuest, setManualGuest] = useState(initialGuest);
  const [editingGuestId, setEditingGuestId] = useState("");
  const [editingValues, setEditingValues] = useState({
    fullName: "",
    phone: "",
    status: "Joyfully Accepts",
    attendeesCount: 1,
    dietaryRestrictions: [],
    dietaryNotes: ""
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const [showInvitationEditor, setShowInvitationEditor] = useState(false);
  const [refreshingGuests, setRefreshingGuests] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const fileInputRef = useRef(null);

  const publicLink = eventSlug
    ? `${window.location.origin}/e/${eventSlug}`
    : `${window.location.origin}/event/${userId}`;

  const filteredGuests = useMemo(() => {
    const query = appliedSearch.trim().toLowerCase();
    if (!query) return guests;
    return guests.filter((guest) => {
      const fullName = String(guest.fullName || "").toLowerCase();
      const email = String(guest.email || "").toLowerCase();
      const phone = String(guest.phone || "").toLowerCase();
      return fullName.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [guests, appliedSearch]);

  const getWhatsappLink = useCallback(
    (guest) =>
      buildUsWhatsAppSendUrl({
        phone: guest.phone,
        guestName: guest.fullName,
        event: eventInfo,
        slug: eventSlug,
        userId,
        origin: window.location.origin
      }),
    [eventInfo, eventSlug, userId]
  );

  const eventDateText = formatUsLongDate(eventInfo?.eventDateFormatted || eventInfo?.countdownTargetDate);

  const loadGuests = async () => {
    const response = await api.get(`/client/${userId}/guests`);
    setSummary(response.data.summary);
    setGuests(response.data.guests);
    setEventInfo(response.data.event || null);
    setEventSlug(response.data.slug || "");
  };

  const refreshGuests = async () => {
    setRefreshingGuests(true);
    try {
      await loadGuests();
    } finally {
      setRefreshingGuests(false);
    }
  };

  useEffect(() => {
    loadGuests();
  }, [userId]);

  const onManualChange = (event) => {
    const { name, value } = event.target;
    setManualGuest((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" ? Number(value) : value
    }));
  };

  const addManualGuest = async (submitEvent) => {
    submitEvent.preventDefault();
    try {
      await api.post(`/client/${userId}/guests/manual`, manualGuest);
      setManualGuest(initialGuest);
      setShowModal(false);
      loadGuests();
    } catch (manualErr) {
      setImportError(manualErr.response?.data?.message || "Failed to add guest");
    }
  };

  const mapRowToGuest = (row) => {
    const fullName = String(row["Guest Name"] ?? row["Full Name"] ?? row["fullName"] ?? row["name"] ?? "").trim();
    const email = String(row["Email"] ?? row["email"] ?? "").trim().toLowerCase();
    const statusRaw = row["RSVP Status"] ?? row["status"] ?? "Joyfully Accepts";
    const amountRaw = row["Guests Attending"] ?? row["attendeesCount"] ?? row["count"] ?? 1;
    const dietaryRaw = row["Dietary Restrictions"] ?? row["dietaryRestrictions"] ?? "";
    const dietaryRestrictions = Array.isArray(dietaryRaw)
      ? dietaryRaw
      : String(dietaryRaw || "")
          .split(/[,;|]/)
          .map((item) => item.trim())
          .filter(Boolean);
    const dietaryNotes = String(row["Dietary Notes"] ?? row["dietaryNotes"] ?? "").trim();
    const phone = String(row["Phone"] ?? row["phone"] ?? row["Phone Number"] ?? "").trim();
    const status =
      String(statusRaw).toLowerCase().includes("declin") || String(statusRaw).toLowerCase() === "no"
        ? "Regretfully Declines"
        : "Joyfully Accepts";

    return {
      fullName,
      email,
      phone,
      attendeesCount: Math.max(0, Number(amountRaw) || 1),
      status,
      dietaryRestrictions,
      dietaryNotes
    };
  };

  const finalizeImport = async (newGuests, resolutions) => {
    await api.post(`/client/${userId}/guests/import`, { newGuests, resolutions });
    await loadGuests();
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError("");
    setImportChecking(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames?.length) {
        setImportError("The spreadsheet is empty or invalid.");
        return;
      }
      const firstSheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "", raw: false });
      const guestsToImport = rows.map(mapRowToGuest).filter((row) => row.fullName && row.email);
      if (!guestsToImport.length) {
        setImportError("No valid rows found. Required columns: Guest Name, Email.");
        return;
      }

      const precheck = await api.post(`/client/${userId}/guests/import/precheck`, { guests: guestsToImport });
      const conflicts = precheck.data?.conflicts || [];
      const newGuests = precheck.data?.newGuests || [];
      setPendingNewGuests(newGuests);

      if (conflicts.length > 0) {
        const defaults = {};
        conflicts.forEach((item) => {
          defaults[item.email] = "keep_existing";
        });
        setImportConflicts(conflicts);
        setConflictChoices(defaults);
        setShowConflictModal(true);
        return;
      }

      await finalizeImport(newGuests, []);
    } catch (importErr) {
      const serverMessage = importErr.response?.data?.message || importErr.response?.data?.error;
      setImportError(serverMessage || "Guest list import failed. Please check the file format.");
    } finally {
      setImportChecking(false);
      event.target.value = "";
    }
  };

  const exportGuests = () => {
    import("xlsx").then((XLSX) => {
      const rows = guests.map((guest) => ({
        "Guest Name": guest.fullName,
        Email: guest.email,
        Phone: guest.phone || "",
        "RSVP Status": guest.status,
        "Guests Attending": guest.attendeesCount,
        "Dietary Restrictions": (guest.dietaryRestrictions || []).join(", "),
        "Dietary Notes": guest.dietaryNotes || "",
        Source: sourceLabel(guest.source)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");
      XLSX.writeFile(workbook, "guest-list.xlsx");
    });
  };

  const downloadTemplate = () => {
    import("xlsx").then((XLSX) => {
      const rows = [
        {
          "Guest Name": "Jane Smith",
          Email: "jane@email.com",
          Phone: "5551234567",
          "RSVP Status": "Joyfully Accepts",
          "Guests Attending": 2,
          "Dietary Restrictions": "Vegetarian",
          "Dietary Notes": "No mushrooms"
        }
      ];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "guest-list-template.xlsx");
    });
  };

  const startEdit = (guest) => {
    setEditingGuestId(guest._id);
    setEditingValues({
      fullName: guest.fullName || "",
      phone: guest.phone || "",
      status: guest.status,
      attendeesCount: guest.attendeesCount,
      dietaryRestrictions: guest.dietaryRestrictions || [],
      dietaryNotes: guest.dietaryNotes || ""
    });
  };

  const saveEdit = async (guestId) => {
    await api.patch(`/client/${userId}/guests/${guestId}`, editingValues);
    setEditingGuestId("");
    await loadGuests();
  };

  const setConflictChoice = (email, choice) => {
    setConflictChoices((prev) => ({ ...prev, [email]: choice }));
  };

  const closeConflictModal = () => {
    setShowConflictModal(false);
    setImportConflicts([]);
    setConflictChoices({});
    setPendingNewGuests([]);
  };

  const applyConflictResolutions = async () => {
    setImportSubmitting(true);
    setImportError("");
    try {
      const resolutions = importConflicts.map((item) => ({
        email: item.email,
        choice: conflictChoices[item.email] || "keep_existing",
        excel: item.excel
      }));
      await finalizeImport(pendingNewGuests, resolutions);
      closeConflictModal();
    } catch (resolveErr) {
      setImportError(resolveErr.response?.data?.message || "Failed to save import resolutions");
    } finally {
      setImportSubmitting(false);
    }
  };

  const copyPublicLink = async () => {
    await navigator.clipboard.writeText(publicLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1600);
  };

  const applySearch = () => {
    setAppliedSearch(searchInput);
  };

  const isEditingAttending = editingValues.status === "Joyfully Accepts";
  const isManualAttending = manualGuest.status === "Joyfully Accepts";

  return (
    <div className="us-client-portal us-dashboard-shell" dir="ltr" lang="en-US">
      <div className="us-dashboard-content">
        <header className="us-dashboard-header">
          <h1>{getOwnerGreeting(eventInfo)}</h1>
          <p>Guest Attendance &amp; RSVP Tracker{eventDateText ? ` · ${eventDateText}` : ""}</p>
          <div className="us-public-link-box">
            <span>Public invitation link:</span>
            <a href={publicLink} target="_blank" rel="noreferrer">
              {publicLink}
            </a>
            <button className="us-btn" type="button" onClick={copyPublicLink}>
              {linkCopied ? "Copied!" : "Copy Link"}
            </button>
            <button
              className="us-btn us-btn--design-portal"
              type="button"
              onClick={() => setShowInvitationEditor(true)}
            >
              ✨ Edit Invitation &amp; Preview
            </button>
          </div>
        </header>

        <div className="us-stats-grid">
          <div className="us-stat-card">
            <h3>Total Invited</h3>
            <p>{summary.totalInvited}</p>
          </div>
          <div className="us-stat-card us-stat-card--attending">
            <h3>Joyfully Attending</h3>
            <p>{summary.totalAttending}</p>
          </div>
          <div className="us-stat-card us-stat-card--declined">
            <h3>Regretfully Declined</h3>
            <p>{summary.totalDeclined}</p>
          </div>
          <div className="us-stat-card us-stat-card--dietary">
            <h3>Dietary Alerts</h3>
            <p>{summary.dietaryAlerts}</p>
          </div>
        </div>

        <div className="us-toolbar">
          <button
            className="us-btn"
            type="button"
            onClick={refreshGuests}
            disabled={refreshingGuests}
            aria-label="Refresh guest list"
            title="Refresh"
          >
            <RotateCw size={16} className={refreshingGuests ? "spinning" : ""} />
          </button>
          <button className="us-btn us-btn--primary" type="button" onClick={() => setShowModal(true)}>
            Add Guest
          </button>
          <button className="us-btn" type="button" onClick={() => fileInputRef.current?.click()} disabled={importChecking}>
            {importChecking ? "Checking file…" : "Import Guest List"}
          </button>
          <button className="us-btn" type="button" onClick={exportGuests}>
            Export Guest List (CSV)
          </button>
          <button className="us-btn" type="button" onClick={downloadTemplate}>
            Download Template
          </button>
          <div className="us-search-wrap">
            <input
              className="us-search-input"
              type="text"
              placeholder="Search name, email, or phone"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
            <button className="us-btn" type="button" onClick={applySearch} aria-label="Search guests">
              <Search size={16} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden-file-input"
            onChange={onImportFile}
          />
        </div>
        {importError ? <p className="us-error-message us-error-message--left">{importError}</p> : null}

        <div className="us-table-wrap">
          <table className="us-guest-table">
            <thead>
              <tr>
                <th>Guest Name</th>
                <th>RSVP Status</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Guests</th>
                <th>Dietary Restrictions</th>
                <th>Dietary &amp; Special Notes</th>
                <th>Source</th>
                <th>WhatsApp</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="us-table-empty">
                    {appliedSearch ? "No guests match your search" : "No guests yet"}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => {
                  const whatsappLink = getWhatsappLink(guest);
                  return (
                  <tr key={guest._id} className={getGuestRowClass(guest.status)}>
                    <td data-label="Guest Name">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="text"
                          value={editingValues.fullName}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, fullName: event.target.value }))
                          }
                          required
                        />
                      ) : (
                        guest.fullName
                      )}
                    </td>
                    <td data-label="RSVP Status">
                      {editingGuestId === guest._id ? (
                        <select
                          className="us-inline-input"
                          value={editingValues.status}
                          onChange={(event) => setEditingValues((prev) => ({ ...prev, status: event.target.value }))}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        guest.status
                      )}
                    </td>
                    <td data-label="Email">{guest.email}</td>
                    <td data-label="Phone">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="tel"
                          value={editingValues.phone}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, phone: event.target.value }))
                          }
                          placeholder="Optional"
                        />
                      ) : (
                        guest.phone || "—"
                      )}
                    </td>
                    <td data-label="Guests">
                      {editingGuestId === guest._id && isEditingAttending ? (
                        <input
                          className="us-inline-input"
                          type="number"
                          min="1"
                          value={editingValues.attendeesCount}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, attendeesCount: Number(event.target.value) }))
                          }
                        />
                      ) : (
                        guest.attendeesCount
                      )}
                    </td>
                    <td data-label="Dietary Restrictions">
                      {editingGuestId === guest._id && isEditingAttending ? (
                        <div className="us-dietary-badges">
                          {DIETARY_OPTIONS.map((option) => (
                            <label key={option} className="us-dietary-badge" style={{ cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={editingValues.dietaryRestrictions.includes(option)}
                                onChange={() =>
                                  setEditingValues((prev) => ({
                                    ...prev,
                                    dietaryRestrictions: toggleDietary(prev.dietaryRestrictions, option)
                                  }))
                                }
                              />{" "}
                              {option}
                            </label>
                          ))}
                        </div>
                      ) : (
                        renderDietaryBadges(guest.dietaryRestrictions)
                      )}
                    </td>
                    <td data-label="Notes">
                      {editingGuestId === guest._id && isEditingAttending ? (
                        <textarea
                          className="us-inline-input"
                          rows={2}
                          value={editingValues.dietaryNotes}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, dietaryNotes: event.target.value }))
                          }
                        />
                      ) : (
                        guest.dietaryNotes || "—"
                      )}
                    </td>
                    <td data-label="Source">
                      <span>{sourceLabel(guest.source)}</span>
                    </td>
                    <td data-label="WhatsApp">
                      {whatsappLink ? (
                        <a
                          className="us-whatsapp-link"
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Send WhatsApp invitation to ${guest.fullName}`}
                          title="Send WhatsApp invitation"
                        >
                          <WhatsAppIcon size={20} />
                        </a>
                      ) : (
                        <span
                          className="us-whatsapp-link us-whatsapp-link--disabled"
                          title="Add a phone number to send WhatsApp"
                          aria-hidden="true"
                        >
                          <WhatsAppIcon size={20} />
                        </span>
                      )}
                    </td>
                    <td data-label="Edit">
                      {editingGuestId === guest._id ? (
                        <button className="us-btn us-btn--primary" type="button" onClick={() => saveEdit(guest._id)}>
                          Save
                        </button>
                      ) : (
                        <button className="us-btn" type="button" onClick={() => startEdit(guest)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showConflictModal ? (
          <div className="us-modal-backdrop" role="presentation">
            <div className="us-modal-card">
              <h2 className="us-modal-title">Duplicate Email Addresses Found</h2>
              <p className="us-login-subtitle us-login-subtitle--left">
                We found {importConflicts.length} guest{importConflicts.length === 1 ? "" : "s"} with an email already
                in your list. Choose whether to keep the existing record or update from the import.
                {pendingNewGuests.length > 0
                  ? ` ${pendingNewGuests.length} new guest${pendingNewGuests.length === 1 ? "" : "s"} will be added automatically.`
                  : ""}
              </p>
              <div className="mt-4 space-y-4">
                {importConflicts.map((item) => (
                  <div key={item.email} className="us-conflict-card">
                    <p className="us-dashboard-emphasis text-sm">{item.email}</p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                      <div>
                        <span className="us-dashboard-emphasis">Current:</span> {item.existing.fullName} ·{" "}
                        {item.existing.status} · {item.existing.attendeesCount} guest
                        {item.existing.attendeesCount === 1 ? "" : "s"}
                      </div>
                      <div>
                        <span className="us-dashboard-emphasis">Import:</span> {item.excel.fullName} · {item.excel.status} ·{" "}
                        {item.excel.attendeesCount} guest{item.excel.attendeesCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                      <label>
                        <input
                          type="radio"
                          name={`conflict-${item.email}`}
                          checked={(conflictChoices[item.email] || "keep_existing") === "keep_existing"}
                          onChange={() => setConflictChoice(item.email, "keep_existing")}
                        />{" "}
                        Keep existing record
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`conflict-${item.email}`}
                          checked={conflictChoices[item.email] === "use_excel"}
                          onChange={() => setConflictChoice(item.email, "use_excel")}
                        />{" "}
                        Update from import
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="button" disabled={importSubmitting} onClick={applyConflictResolutions}>
                  {importSubmitting ? "Saving…" : "Confirm & Save Import"}
                </button>
                <button className="us-btn" type="button" onClick={closeConflictModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showModal ? (
          <div className="us-modal-backdrop" role="presentation">
            <form className="us-modal-card" onSubmit={addManualGuest}>
              <h2 className="us-modal-title">Add Guest Manually</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="us-field-label" htmlFor="manual-fullName">
                    Guest Name
                  </label>
                  <input
                    id="manual-fullName"
                    className="us-field-input"
                    name="fullName"
                    value={manualGuest.fullName}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-email">
                    Email
                  </label>
                  <input
                    id="manual-email"
                    className="us-field-input"
                    name="email"
                    type="email"
                    value={manualGuest.email}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-phone">
                    Phone Number <span className="normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    id="manual-phone"
                    className="us-field-input"
                    name="phone"
                    type="tel"
                    placeholder="5551234567"
                    value={manualGuest.phone}
                    onChange={onManualChange}
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-status">
                    RSVP Status
                  </label>
                  <select
                    id="manual-status"
                    className="us-field-input"
                    name="status"
                    value={manualGuest.status}
                    onChange={onManualChange}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isManualAttending ? (
                  <>
                    <div>
                      <label className="us-field-label" htmlFor="manual-attendeesCount">
                        Guests Attending
                      </label>
                      <input
                        id="manual-attendeesCount"
                        className="us-field-input"
                        name="attendeesCount"
                        type="number"
                        min="1"
                        value={manualGuest.attendeesCount}
                        onChange={onManualChange}
                        required
                      />
                    </div>
                    <fieldset>
                      <legend className="us-field-label">Dietary Restrictions</legend>
                      <div className="us-dietary-badges mt-2">
                        {DIETARY_OPTIONS.map((option) => (
                          <label key={option} className="us-dietary-badge" style={{ cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={manualGuest.dietaryRestrictions.includes(option)}
                              onChange={() =>
                                setManualGuest((prev) => ({
                                  ...prev,
                                  dietaryRestrictions: toggleDietary(prev.dietaryRestrictions, option)
                                }))
                              }
                            />{" "}
                            {option}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <label className="us-field-label" htmlFor="manual-dietaryNotes">
                        Dietary &amp; Special Notes
                      </label>
                      <textarea
                        id="manual-dietaryNotes"
                        className="us-inline-input"
                        name="dietaryNotes"
                        rows={3}
                        value={manualGuest.dietaryNotes}
                        onChange={onManualChange}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="submit">
                  Save Guest
                </button>
                <button className="us-btn" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {showInvitationEditor && eventInfo ? (
          <UsInvitationEditor
            userId={userId}
            eventInfo={eventInfo}
            slug={eventSlug}
            onClose={() => setShowInvitationEditor(false)}
            onSaved={(updatedEvent) => {
              setEventInfo(updatedEvent);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
