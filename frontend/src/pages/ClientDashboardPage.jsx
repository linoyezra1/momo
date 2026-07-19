import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronDown, Clock, HelpCircle, Pencil, RotateCw, Search, Trash2, Users, X } from "lucide-react";
import api from "../api";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { buildWhatsAppSendUrl } from "../utils/whatsapp";
import { resolveInviteCopyDefaults } from "../utils/whatsappInviteCopy";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize";
import { formatFailedRowLabel, mergeFailedRows, parseExcelGuestRows } from "../utils/guestExcelImport";
import IlInvitationEditor from "../il/components/IlInvitationEditor.jsx";
import IlWhatsAppInviteEditor from "../il/components/IlWhatsAppInviteEditor.jsx";
import "../us/client-portal.css";
import "../il/il-portal.css";

const initialGuest = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  giftAmount: 0,
  status: "מגיע"
};

const STATUS_OPTIONS = [
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" },
  { value: "לא ידוע", label: "לא ידוע" }
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "הכל" },
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" },
  { value: "לא ידוע", label: "לא ידוע" }
];

const REMINDER_FILTER_OPTIONS = [
  { value: "all", label: "כל סבבי השליחה" },
  { value: "0", label: "טרם נשלחו" },
  { value: "1", label: "סבב 1 בלבד" },
  { value: "2", label: "סבב 2 בלבד" },
  { value: "3", label: "סבב 3 בלבד" },
  { value: "4+", label: "סבב 4 ומעלה" }
];

function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function getGuestRowClass(status) {
  if (status === "מגיע") return "il-row-coming";
  if (status === "לא מגיע") return "il-row-not-coming";
  if (status === "אולי") return "il-row-maybe";
  return "il-row-unknown";
}

function isUnknownGuestStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return !normalized || normalized === "לא ידוע" || normalized === "unknown" || normalized === "pending";
}

function getReminderRound(guest) {
  return Number(guest?.reminderRound) || 0;
}

function ReminderRoundBadge({ round }) {
  if (round <= 0) {
    return (
      <span className="il-reminder-badge il-reminder-badge--pending">
        <Clock size={14} aria-hidden="true" />
        טרם נשלח
      </span>
    );
  }

  const badgeClass =
    round === 1 ? "il-reminder-badge--round1" : "il-reminder-badge--round2";

  return (
    <span className={`il-reminder-badge ${badgeClass}`}>
      סבב {round} נשלח
    </span>
  );
}

function hasPhoneRsvpRecord(guest) {
  return Boolean(guest?.callHistory?.length || guest?.callTimestamp);
}

function formatCallStatusLabel(callStatus) {
  if (callStatus === "answered") return "ענה";
  if (callStatus === "no_answer") return "לא ענה";
  if (callStatus === "disconnected") return "מנותק";
  return "—";
}

function getPhoneTreatmentBadge(guest, maxPhoneRounds) {
  const attempts = Math.max(0, Number(guest?.phoneAttemptsCount || 0));
  if (attempts === 0) {
    return { label: "טרם טופל טלפונית", tone: "pending" };
  }
  if (guest?.callStatus === "answered") {
    return { label: "✓ ענה טלפונית", tone: "answered" };
  }
  if (attempts >= maxPhoneRounds) {
    return { label: "ללא מענה סופית", tone: "exhausted" };
  }
  return { label: `לא ענה - סבב ${attempts}`, tone: "no-answer" };
}

function getGuestCallHistory(guest) {
  if (Array.isArray(guest?.callHistory) && guest.callHistory.length) {
    return guest.callHistory;
  }
  if (!guest?.callTimestamp) return [];
  return [
    {
      attemptNumber: guest.currentCallRound || guest.phoneAttemptsCount || 1,
      callRound: guest.currentCallRound || 1,
      callStatus: guest.callStatus,
      rsvpStatus: guest.status,
      attendeesCount: guest.attendeesCount,
      agentNotes: guest.agentNotes || ""
    }
  ];
}

function buildStatusDonutGradient(summary) {
  const values = [
    { value: Number(summary.totalComing || 0), color: "#d57e7e" },
    { value: Number(summary.totalNotComing || 0), color: "#9b5a5a" },
    { value: Number(summary.totalMaybe || 0), color: "#d4af37" },
    { value: Number(summary.totalUnknown || 0), color: "#94a3b8" }
  ];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "conic-gradient(#e5e7eb 0 100%)";

  let cursor = 0;
  const stops = values
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${item.color} ${start}% ${cursor}%`;
    });
  return `conic-gradient(${stops.join(", ")})`;
}

function getOwnerGreeting(event) {
  if (!event) return "שלום";
  if (event.eventType === "חתונה") {
    return `שלום ${event.groomName || ""} ו${event.brideName || ""}`.trim();
  }
  if (event.eventType === "ברית") {
    return `שלום ${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim();
  }
  if (event.eventType === "בת מצווה") {
    return `שלום ${event.parentName1 || ""}`.trim();
  }
  return "שלום";
}

export default function ClientDashboardPage() {
  const { userId } = useParams();
  const [summary, setSummary] = useState({
    totalInvited: 0,
    totalComing: 0,
    totalNotComing: 0,
    totalMaybe: 0,
    totalUnknown: 0
  });
  const [importError, setImportError] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [importConflicts, setImportConflicts] = useState([]);
  const [conflictChoices, setConflictChoices] = useState({});
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importChecking, setImportChecking] = useState(false);
  const [pendingNewGuests, setPendingNewGuests] = useState([]);
  const [pendingImportMeta, setPendingImportMeta] = useState({ totalCount: 0, failedRows: [], warningRows: [] });
  const [importSummary, setImportSummary] = useState(null);
  const [guests, setGuests] = useState([]);
  const [eventInfo, setEventInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [manualGuest, setManualGuest] = useState(initialGuest);
  const [editingGuestId, setEditingGuestId] = useState("");
  const [editingValues, setEditingValues] = useState({
    fullName: "",
    phone: "",
    status: "מגיע",
    attendeesCount: 1,
    giftAmount: 0
  });
  const [editError, setEditError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingGuests, setDeletingGuests] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showInvitationEditor, setShowInvitationEditor] = useState(false);
  const [refreshingGuests, setRefreshingGuests] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reminderRoundFilter, setReminderRoundFilter] = useState("all");
  const [selectedGuestIds, setSelectedGuestIds] = useState(() => new Set());
  const [expandedGuestDetailIds, setExpandedGuestDetailIds] = useState(() => new Set());
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [paymentCode, setPaymentCode] = useState("");
  const [inviteCopy, setInviteCopy] = useState({
    welcomeParagraph: "",
    eventDetailsParagraph: "",
    closingParagraph: ""
  });
  const [inviteCopySaveState, setInviteCopySaveState] = useState("");
  const [whatsappQuota, setWhatsappQuota] = useState(null);
  const [whatsappQuotas, setWhatsappQuotas] = useState([]);
  const [bulkWhatsAppSending, setBulkWhatsAppSending] = useState(false);
  const [bulkWhatsAppResult, setBulkWhatsAppResult] = useState("");
  const [bulkWhatsAppError, setBulkWhatsAppError] = useState("");
  const fileInputRef = useRef(null);
  const inviteCopySaveTimerRef = useRef(null);
  const inviteCopyHydratedRef = useRef(false);

  const publicLink = `${window.location.origin}/event/${userId}`;

  const filteredGuests = useMemo(() => {
    let list = guests;

    if (statusFilter === "לא ידוע") {
      list = list.filter((guest) => isUnknownGuestStatus(guest.status));
    } else if (statusFilter !== "all") {
      list = list.filter((guest) => guest.status === statusFilter);
    }

    if (reminderRoundFilter.endsWith("+")) {
      const minimumRound = Number(reminderRoundFilter.slice(0, -1));
      list = list.filter((guest) => getReminderRound(guest) >= minimumRound);
    } else if (reminderRoundFilter !== "all") {
      const exactRound = Number(reminderRoundFilter);
      list = list.filter((guest) => getReminderRound(guest) === exactRound);
    }

    const query = appliedSearch.trim().toLowerCase();
    if (!query) return list;

    return list.filter((guest) => {
      const fullName = String(guest.fullName || "").toLowerCase();
      const phone = String(guest.phone || "");
      return fullName.includes(query) || phone.includes(query);
    });
  }, [guests, appliedSearch, statusFilter, reminderRoundFilter]);

  const loadWhatsappQuota = async () => {
    try {
      const response = await api.get(`/client/${userId}/whatsapp/quota`);
      const quota = response.data?.quota || null;
      const quotas = Array.isArray(response.data?.quotas) ? response.data.quotas : [];
      setWhatsappQuota(quota);
      setWhatsappQuotas(quotas);
      if (quota?.code) {
        setPaymentCode(quota.code);
      }
    } catch {
      setWhatsappQuota(null);
      setWhatsappQuotas([]);
    }
  };

  const loadGuests = async () => {
    const response = await api.get(`/client/${userId}/guests`);
    setSummary(response.data.summary);
    setGuests(response.data.guests);
    setEventInfo(response.data.event || null);
    await loadWhatsappQuota();
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

  useEffect(() => {
    const stream = new EventSource(`/api/client/${userId}/live-updates`);
    let refreshTimer;

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!["guest-phone-rsvp-updated", "guest-whatsapp-rsvp-updated"].includes(payload.type)) return;
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          loadGuests();
        }, 120);
      } catch {
        // Ignore malformed keepalive/event payloads; EventSource reconnects automatically.
      }
    };

    return () => {
      window.clearTimeout(refreshTimer);
      stream.close();
    };
  }, [userId]);

  const onManualChange = (event) => {
    const { name, value } = event.target;
    setManualGuest((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" || name === "giftAmount" ? Number(value) : value
    }));
  };

  const setManualStatus = (status) => {
    setManualGuest((prev) => ({ ...prev, status }));
  };

  const addManualGuest = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/client/${userId}/guests/manual`, {
        ...manualGuest,
        phone: normalizeIsraeliPhone(manualGuest.phone)
      });
      setManualGuest(initialGuest);
      setShowModal(false);
      loadGuests();
    } catch (manualErr) {
      setImportError(manualErr.response?.data?.message || "הוספת מוזמן נכשלה");
    }
  };

  const hydrateInviteCopy = useCallback((event) => {
    setInviteCopy(resolveInviteCopyDefaults(event || {}));
    inviteCopyHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!eventInfo || inviteCopyHydratedRef.current) return;
    hydrateInviteCopy(eventInfo);
  }, [eventInfo, hydrateInviteCopy]);

  useEffect(() => {
    return () => {
      if (inviteCopySaveTimerRef.current) {
        clearTimeout(inviteCopySaveTimerRef.current);
      }
    };
  }, []);

  const persistInviteCopy = useCallback(
    async (nextCopy) => {
      try {
        setInviteCopySaveState("saving");
        const response = await api.patch(`/client/${userId}/whatsapp-invite-copy`, nextCopy);
        const saved = response.data?.event || nextCopy;
        setEventInfo((prev) =>
          prev
            ? {
                ...prev,
                welcomeParagraph: saved.welcomeParagraph ?? nextCopy.welcomeParagraph,
                eventDetailsParagraph:
                  saved.eventDetailsParagraph ?? nextCopy.eventDetailsParagraph,
                closingParagraph: saved.closingParagraph ?? nextCopy.closingParagraph
              }
            : prev
        );
        setInviteCopySaveState("saved");
      } catch {
        setInviteCopySaveState("error");
      }
    },
    [userId]
  );

  const onInviteCopyChange = useCallback(
    (nextCopy) => {
      setInviteCopy(nextCopy);
      setInviteCopySaveState("");
      if (inviteCopySaveTimerRef.current) {
        clearTimeout(inviteCopySaveTimerRef.current);
      }
      inviteCopySaveTimerRef.current = setTimeout(() => {
        persistInviteCopy(nextCopy);
      }, 700);
    },
    [persistInviteCopy]
  );

  const selectedCount = selectedGuestIds.size;
  const maxPhoneRounds = Number(eventInfo?.maxPhoneRounds || 0);
  const phoneServiceEnabled = maxPhoneRounds > 0;
  const guestTableColumnCount = phoneServiceEnabled ? 12 : 11;
  const totalInvited = Number(
    summary.totalInvited ??
      summary.totalComing +
        summary.totalNotComing +
        summary.totalMaybe +
        (summary.totalUnknown || 0)
  );
  const totalAttending = Number(summary.totalComing || 0);
  const attendingPercentage =
    totalInvited > 0 ? Math.round((totalAttending / totalInvited) * 100) : 0;
  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((guest) => selectedGuestIds.has(guest._id));

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

  const toggleGuestDetails = (guestId) => {
    setExpandedGuestDetailIds((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  };

  const onBulkWhatsAppSuccess = async (data) => {
    if (!data?.partial) {
      setSelectedGuestIds(new Set());
    }
    if (typeof data?.remaining === "number") {
      setWhatsappQuota((prev) =>
        prev ? { ...prev, remaining_credits: data.remaining } : prev
      );
    } else {
      await loadWhatsappQuota();
    }
    await loadGuests();
  };

  const openBulkWhatsApp = () => {
    setBulkWhatsAppResult("");
    setBulkWhatsAppError("");
    setShowBulkWhatsApp(true);
  };

  const sendBulkWhatsApp = async (event) => {
    event.preventDefault();
    if (!selectedCount) {
      setBulkWhatsAppError("יש לבחור לפחות מוזמן אחד מהטבלה");
      return;
    }
    if (!paymentCode.trim()) {
      setBulkWhatsAppError("יש להזין קוד רכישה");
      return;
    }

    if (inviteCopySaveTimerRef.current) {
      clearTimeout(inviteCopySaveTimerRef.current);
      inviteCopySaveTimerRef.current = null;
    }
    await persistInviteCopy(inviteCopy);

    setBulkWhatsAppSending(true);
    setBulkWhatsAppResult("");
    setBulkWhatsAppError("");
    try {
      const response = await api.post(`/client/${userId}/whatsapp/bulk-send`, {
        paymentCode: paymentCode.trim(),
        guestIds: [...selectedGuestIds]
      });

      if (response.data?.success === false) {
        setBulkWhatsAppResult("");
        setBulkWhatsAppError(response.data?.message || "שליחת ההודעות נכשלה");
        return;
      }

      setBulkWhatsAppError("");
      setBulkWhatsAppResult(response.data?.message || "ההודעות נשלחו בהצלחה");
      await onBulkWhatsAppSuccess(response.data);
    } catch (bulkErr) {
      setBulkWhatsAppResult("");
      setBulkWhatsAppError(
        bulkErr.response?.data?.message || "שליחת ההודעה נכשלה, נא לוודא שמספר המערכת מוגדר כראוי"
      );
    } finally {
      setBulkWhatsAppSending(false);
    }
  };

  const getWhatsappLink = useCallback(
    (phone) =>
      buildWhatsAppSendUrl({
        phone,
        event: eventInfo,
        eventId: userId,
        origin: window.location.origin
      }),
    [eventInfo, userId]
  );

  const sourceLabel = (source) => {
    if (source === "excel") return "קובץ אקסל";
    if (source === "excel_and_form") return "הועלה מאקסל ואישר עצמית";
    if (source === "form" || source === "public") return "אישור הגעה עצמי";
    return "ידני";
  };

  const finalizeImport = async (newGuests, resolutions, meta = {}) => {
    const response = await api.post(`/client/${userId}/guests/import`, {
      newGuests,
      resolutions,
      totalCount: meta.totalCount,
      failedRows: meta.failedRows || [],
      warningRows: meta.warningRows || []
    });
    await loadGuests();
    const data = response.data || {};
    setImportSummary({
      uploadedCount: Number(data.uploadedCount || 0),
      totalCount: Number(data.totalCount || meta.totalCount || 0),
      failedRows: mergeFailedRows(meta.failedRows || [], data.failedRows || []),
      warningRows: mergeFailedRows(meta.warningRows || [], data.warningRows || [])
    });
    return data;
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError("");
    setImportSummary(null);
    setImportChecking(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames?.length) {
        setImportError("קובץ האקסל ריק או לא תקין.");
        return;
      }
      const firstSheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "", raw: false });
      const { totalCount, validGuests, failedRows, warningRows } = parseExcelGuestRows(rows);

      if (!totalCount) {
        setImportError("לא נמצאו שורות תקינות. ודאו שיש עמודות: שם מלא, טלפון, וכמות (אופציונלי).");
        return;
      }

      if (!validGuests.length) {
        setImportSummary({
          uploadedCount: 0,
          totalCount,
          failedRows,
          warningRows
        });
        return;
      }

      const precheck = await api.post(`/client/${userId}/guests/import/precheck`, { guests: validGuests });
      const conflicts = precheck.data?.conflicts || [];
      const newGuests = precheck.data?.newGuests || [];
      const precheckFailed = mergeFailedRows(failedRows, precheck.data?.failedRows || []);
      const precheckWarnings = mergeFailedRows(warningRows, precheck.data?.warningRows || []);
      const importMeta = {
        totalCount: Number(precheck.data?.totalCount || totalCount),
        failedRows: precheckFailed,
        warningRows: precheckWarnings
      };
      setPendingNewGuests(newGuests);
      setPendingImportMeta(importMeta);

      if (conflicts.length > 0) {
        const defaults = {};
        conflicts.forEach((item) => {
          defaults[item.phone] = "keep_existing";
        });
        setImportConflicts(conflicts);
        setConflictChoices(defaults);
        setShowConflictModal(true);
        return;
      }

      await finalizeImport(newGuests, [], importMeta);
    } catch (importErr) {
      const serverMessage = importErr.response?.data?.message || importErr.response?.data?.error;
      setImportError(serverMessage || "העלאת קובץ האקסל נכשלה. בדקו את הפורמט ונסו שוב.");
    } finally {
      setImportChecking(false);
      event.target.value = "";
    }
  };

  const exportGuests = () => {
    import("xlsx").then((XLSX) => {
      const rows = guests.map((guest) => ({
        "שם מלא": guest.fullName,
        טלפון: guest.phone,
        "סטטוס הגעה": guest.status,
        "כמות מגיעים": guest.attendeesCount,
        "סכום מתנה": guest.giftAmount || 0,
        "סבב שליחה": getReminderRound(guest),
        מקור: sourceLabel(guest.source)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");
      XLSX.writeFile(workbook, "guests.xlsx");
    });
  };

  const downloadTemplate = () => {
    import("xlsx").then((XLSX) => {
      const rows = [{ "שם מלא": "ישראל ישראלי", טלפון: "0501234567", "כמות אנשים": 2 }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "guests-template.xlsx");
    });
  };

  const startEdit = (guest) => {
    setEditError("");
    setEditingGuestId(guest._id);
    setEditingValues({
      fullName: guest.fullName || "",
      phone: guest.phone || "",
      status: guest.status,
      attendeesCount: guest.attendeesCount,
      giftAmount: guest.giftAmount || 0
    });
  };

  const cancelEdit = () => {
    setEditingGuestId("");
    setEditError("");
  };

  const saveEdit = async (guestId) => {
    setEditError("");
    try {
      await api.patch(`/client/${userId}/guests/${guestId}`, {
        ...editingValues,
        phone: normalizeIsraeliPhone(editingValues.phone)
      });
      setEditingGuestId("");
      await loadGuests();
    } catch (saveErr) {
      setEditError(saveErr.response?.data?.message || "שמירת העריכה נכשלה");
    }
  };

  const requestDeleteGuest = (guest) => {
    setDeleteConfirm({
      mode: "single",
      guestIds: [guest._id],
      label: guest.fullName || "המוזמן"
    });
  };

  const requestBulkDelete = () => {
    if (!selectedCount) return;
    setDeleteConfirm({
      mode: "bulk",
      guestIds: [...selectedGuestIds],
      label: `${selectedCount} מוזמנים`
    });
  };

  const closeDeleteConfirm = () => {
    if (deletingGuests) return;
    setDeleteConfirm(null);
  };

  const confirmDeleteGuests = async () => {
    if (!deleteConfirm?.guestIds?.length) return;
    setDeletingGuests(true);
    try {
      if (deleteConfirm.mode === "single") {
        await api.delete(`/client/${userId}/guests/${deleteConfirm.guestIds[0]}`);
      } else {
        await api.post(`/client/${userId}/guests/bulk-delete`, {
          guestIds: deleteConfirm.guestIds
        });
      }
      setSelectedGuestIds((prev) => {
        const next = new Set(prev);
        deleteConfirm.guestIds.forEach((id) => next.delete(id));
        return next;
      });
      if (editingGuestId && deleteConfirm.guestIds.includes(editingGuestId)) {
        setEditingGuestId("");
      }
      setDeleteConfirm(null);
      await loadGuests();
    } catch (deleteErr) {
      setImportError(deleteErr.response?.data?.message || "מחיקת המוזמנים נכשלה");
      setDeleteConfirm(null);
    } finally {
      setDeletingGuests(false);
    }
  };

  const setConflictChoice = (phone, choice) => {
    setConflictChoices((prev) => ({ ...prev, [phone]: choice }));
  };

  const closeConflictModal = () => {
    setShowConflictModal(false);
    setImportConflicts([]);
    setConflictChoices({});
    setPendingNewGuests([]);
    setPendingImportMeta({ totalCount: 0, failedRows: [], warningRows: [] });
  };

  const applyConflictResolutions = async () => {
    setImportSubmitting(true);
    setImportError("");
    try {
      const resolutions = importConflicts.map((item) => ({
        phone: item.phone,
        choice: conflictChoices[item.phone] || "keep_existing",
        rowNumber: item.rowNumber,
        excel: item.excel
      }));
      await finalizeImport(pendingNewGuests, resolutions, pendingImportMeta);
      closeConflictModal();
    } catch (resolveErr) {
      setImportError(resolveErr.response?.data?.message || "שמירת הייבוא נכשלה");
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

  return (
    <div className="us-client-portal il-client-portal us-dashboard-shell" dir="rtl" lang="he">
      <div className="us-dashboard-content">
        <header className="us-dashboard-header">
          <h1>{getOwnerGreeting(eventInfo)}</h1>
          <p>ניהול אורחים ואישורי הגעה לאירוע</p>
          <div className="us-public-link-box">
            <span>קישור ציבורי לאישור הגעה:</span>
            <a href={publicLink} target="_blank" rel="noreferrer">
              {publicLink}
            </a>
            <button className="us-btn" type="button" onClick={copyPublicLink}>
              {linkCopied ? "הועתק" : "העתק קישור"}
            </button>
            <button
              className="us-btn us-btn--design-portal"
              type="button"
              onClick={() => setShowInvitationEditor(true)}
            >
              ✨ עריכת הזמנה ותצוגה חיה
            </button>
            <Link className="us-btn us-btn--primary il-seating-nav-btn" to={`/client/dashboard/${userId}/seating`}>
              🪑 מערכת הושבה
            </Link>
          </div>
        </header>

        <div className="us-stats-grid">
          <button
            className={`us-stat-card us-stat-card--filter${statusFilter === "all" ? " is-active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
          >
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Users size={20} aria-hidden="true" />
              <h3>סה״כ מוזמנים</h3>
            </div>
            <p>
              {summary.totalInvited ??
                summary.totalComing + summary.totalNotComing + summary.totalMaybe + (summary.totalUnknown || 0)}
            </p>
          </button>
          <button
            className={`us-stat-card us-stat-card--coming us-stat-card--filter${statusFilter === "מגיע" ? " is-active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("מגיע")}
            aria-pressed={statusFilter === "מגיע"}
          >
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Check size={20} aria-hidden="true" />
              <h3>סה״כ מגיעים</h3>
            </div>
            <p>{summary.totalComing}</p>
          </button>
          <button
            className={`us-stat-card us-stat-card--not-coming us-stat-card--filter${statusFilter === "לא מגיע" ? " is-active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("לא מגיע")}
            aria-pressed={statusFilter === "לא מגיע"}
          >
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <X size={20} aria-hidden="true" />
              <h3>סה״כ לא מגיעים</h3>
            </div>
            <p>{summary.totalNotComing}</p>
          </button>
          <button
            className={`us-stat-card us-stat-card--maybe us-stat-card--filter${statusFilter === "אולי" ? " is-active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("אולי")}
            aria-pressed={statusFilter === "אולי"}
          >
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <HelpCircle size={20} aria-hidden="true" />
              <h3>סה״כ אולי</h3>
            </div>
            <p>{summary.totalMaybe}</p>
          </button>
          <button
            className={`us-stat-card us-stat-card--unknown us-stat-card--filter${statusFilter === "לא ידוע" ? " is-active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("לא ידוע")}
            aria-pressed={statusFilter === "לא ידוע"}
          >
            <div className="us-stat-card-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={20} aria-hidden="true" />
              <h3>סה״כ לא ידוע</h3>
            </div>
            <p>{summary.totalUnknown || 0}</p>
          </button>
        </div>

        <section className="il-status-donut-card" aria-label="התפלגות סטטוסי הגעה">
          <div
            className="il-status-donut"
            style={{ background: buildStatusDonutGradient(summary) }}
            aria-hidden="true"
          >
            <div className="il-status-donut__center">
              <strong>{attendingPercentage}%</strong>
              <span>אישרו הגעה</span>
              <small>{totalAttending} / {totalInvited}</small>
            </div>
          </div>
          <div className="il-status-donut__content">
            <h2>התפלגות סטטוסים</h2>
            <div className="il-status-donut__legend">
              <span><i className="is-coming" /> מגיעים: {summary.totalComing || 0}</span>
              <span><i className="is-not-coming" /> לא מגיעים: {summary.totalNotComing || 0}</span>
              <span><i className="is-maybe" /> אולי: {summary.totalMaybe || 0}</span>
              <span><i className="is-unknown" /> לא ידוע: {summary.totalUnknown || 0}</span>
            </div>
          </div>
        </section>

        <div className="us-toolbar">
          <button
            className="us-btn"
            type="button"
            onClick={refreshGuests}
            disabled={refreshingGuests}
            aria-label="רענון רשימת מוזמנים"
            title="רענון"
          >
            <RotateCw size={16} className={refreshingGuests ? "spinning" : ""} />
          </button>
          <button className="us-btn us-btn--primary" type="button" onClick={() => setShowModal(true)}>
            הוספת מוזמן ידנית
          </button>
          <button className="us-btn" type="button" onClick={() => fileInputRef.current?.click()} disabled={importChecking}>
            {importChecking ? "בודק קובץ…" : "העלאת מוזמנים מאקסל"}
          </button>
          <button className="us-btn" type="button" onClick={exportGuests}>
            ייצוא לאקסל
          </button>
          <button
            className="us-btn il-bulk-send-btn"
            type="button"
            onClick={openBulkWhatsApp}
            disabled={!selectedCount}
          >
            שלח ווצאפ בתפוצה רחבה
          </button>
          <button className="us-btn" type="button" onClick={downloadTemplate}>
            הורדת קובץ אקסל לדוגמה
          </button>
          <div className="us-search-wrap">
            <input
              className="us-search-input"
              type="text"
              placeholder="חיפוש שם / טלפון"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
            <button className="us-btn" type="button" onClick={applySearch} aria-label="חפש">
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

        <div className="il-guest-filters">
          <div className="il-guest-filter-group" role="group" aria-label="סינון לפי סטטוס הגעה">
            <span className="il-guest-filter-label">סטטוס הגעה:</span>
            <div className="il-status-filter-tabs">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`il-status-filter-tab${statusFilter === option.value ? " is-active" : ""}`}
                  onClick={() => setStatusFilter(option.value)}
                  aria-pressed={statusFilter === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="il-guest-filter-group">
            <label className="il-guest-filter-label" htmlFor="reminder-round-filter">
              סטטוס שליחה:
            </label>
            <select
              id="reminder-round-filter"
              className="us-field-input il-reminder-filter-select"
              value={reminderRoundFilter}
              onChange={(event) => setReminderRoundFilter(event.target.value)}
            >
              {REMINDER_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="il-guest-filter-summary">
            מוצגים <strong>{filteredGuests.length}</strong> מתוך {guests.length} מוזמנים
          </p>
        </div>

        <div className="us-table-wrap">
          <table className="us-guest-table">
            <thead>
              <tr>
                <th className="il-col-check">
                  <input
                    type="checkbox"
                    aria-label="בחירת כל המוזמנים המוצגים"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    disabled={!filteredGuests.length}
                  />
                </th>
                <th className="il-col-expand" aria-label="פרטים" />
                <th>שם מלא</th>
                <th>טלפון</th>
                <th>כמה מגיעים</th>
                <th>סכום מתנה</th>
                <th>סטטוס</th>
                {phoneServiceEnabled ? <th>טיפול טלפוני</th> : null}
                <th>סבב שליחה</th>
                <th>מקור</th>
                <th>וואטסאפ</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={guestTableColumnCount} className="us-table-empty">
                    {appliedSearch || statusFilter !== "all" || reminderRoundFilter !== "all"
                      ? "לא נמצאו תוצאות לסינון הנוכחי"
                      : "אין אורחים עדיין"}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => {
                  const isDetailExpanded = expandedGuestDetailIds.has(guest._id);
                  const showPhoneDetails = hasPhoneRsvpRecord(guest);
                  const phoneTreatment = phoneServiceEnabled
                    ? getPhoneTreatmentBadge(guest, maxPhoneRounds)
                    : null;
                  return (
                    <Fragment key={guest._id}>
                      <tr className={getGuestRowClass(guest.status)}>
                        <td data-label="בחירה" className="il-col-check">
                          <input
                            type="checkbox"
                            aria-label={`בחירת ${guest.fullName}`}
                            checked={selectedGuestIds.has(guest._id)}
                            onChange={() => toggleGuestSelection(guest._id)}
                          />
                        </td>
                        <td data-label="פרטים" className="il-col-expand">
                          {showPhoneDetails ? (
                            <button
                              type="button"
                              className={`il-row-expand-btn${isDetailExpanded ? " is-open" : ""}`}
                              onClick={() => toggleGuestDetails(guest._id)}
                              aria-expanded={isDetailExpanded}
                              aria-label={`פרטי אישור טלפוני עבור ${guest.fullName}`}
                            >
                              <ChevronDown size={16} aria-hidden="true" />
                            </button>
                          ) : null}
                        </td>
                    <td data-label="שם מלא">
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
                    <td data-label="טלפון" dir="ltr">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="tel"
                          inputMode="tel"
                          value={editingValues.phone}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, phone: event.target.value }))
                          }
                          required
                        />
                      ) : (
                        guest.phone
                      )}
                    </td>
                    <td data-label="כמה מגיעים">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="number"
                          min="0"
                          value={editingValues.attendeesCount}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, attendeesCount: Number(event.target.value) }))
                          }
                        />
                      ) : (
                        guest.attendeesCount
                      )}
                    </td>
                    <td data-label="סכום מתנה">
                      {editingGuestId === guest._id ? (
                        <input
                          className="us-inline-input"
                          type="number"
                          min="0"
                          value={editingValues.giftAmount || 0}
                          onChange={(event) =>
                            setEditingValues((prev) => ({ ...prev, giftAmount: Number(event.target.value) }))
                          }
                        />
                      ) : (
                        guest.giftAmount || 0
                      )}
                    </td>
                    <td data-label="סטטוס">
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
                    {phoneTreatment ? (
                      <td data-label="טיפול טלפוני">
                        <span className={`il-phone-treatment-badge is-${phoneTreatment.tone}`}>
                          {phoneTreatment.label}
                        </span>
                      </td>
                    ) : null}
                    <td data-label="סבב שליחה">
                      <ReminderRoundBadge round={getReminderRound(guest)} />
                    </td>
                    <td data-label="מקור">
                      <span>{sourceLabel(guest.source)}</span>
                    </td>
                    <td data-label="וואטסאפ">
                      <a
                        className="us-whatsapp-link"
                        href={getWhatsappLink(guest.phone)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="שליחת הודעת וואטסאפ"
                        title="שליחת וואטסאפ"
                      >
                        <WhatsAppIcon size={20} />
                      </a>
                    </td>
                    <td data-label="פעולות">
                      <div className="il-guest-actions">
                        {editingGuestId === guest._id ? (
                          <>
                            <button
                              className="us-btn us-btn--primary"
                              type="button"
                              onClick={() => saveEdit(guest._id)}
                            >
                              שמירה
                            </button>
                            <button className="us-btn" type="button" onClick={cancelEdit}>
                              ביטול
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="il-icon-btn"
                              type="button"
                              onClick={() => startEdit(guest)}
                              aria-label={`עריכת ${guest.fullName}`}
                              title="עריכה"
                            >
                              <Pencil size={18} aria-hidden="true" />
                            </button>
                            <button
                              className="il-icon-btn il-icon-btn--danger"
                              type="button"
                              onClick={() => requestDeleteGuest(guest)}
                              aria-label={`מחיקת ${guest.fullName}`}
                              title="מחיקה"
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                      {editingGuestId === guest._id && editError ? (
                        <p className="il-inline-edit-error">{editError}</p>
                      ) : null}
                    </td>
                      </tr>
                      {showPhoneDetails && isDetailExpanded ? (
                        <tr className="il-guest-detail-row">
                          <td colSpan={guestTableColumnCount}>
                            <div className="il-call-history">
                              <div className="il-call-history__header">
                                <strong>היסטוריית שיחות טלפוניות</strong>
                                <span>{getGuestCallHistory(guest).length} ניסיונות</span>
                              </div>
                              <div className="il-call-history__timeline">
                                {getGuestCallHistory(guest).map((entry, index) => (
                                  <article
                                    className="il-call-history__item"
                                    key={`${entry.attemptNumber || index}-${index}`}
                                  >
                                    <span className="il-call-history__marker" aria-hidden="true">
                                      {entry.attemptNumber || index + 1}
                                    </span>
                                    <div className="il-call-history__grid">
                                      <div>
                                        <span>סבב חיוג</span>
                                        <strong>{entry.callRound || entry.attemptNumber || index + 1}</strong>
                                      </div>
                                      <div>
                                        <span>סטטוס שיחה</span>
                                        <strong>{formatCallStatusLabel(entry.callStatus)}</strong>
                                      </div>
                                      <div>
                                        <span>האם מגיע?</span>
                                        <strong>{entry.rsvpStatus || "—"}</strong>
                                      </div>
                                      <div>
                                        <span>כמות אורחים</span>
                                        <strong>{entry.attendeesCount ?? "—"}</strong>
                                      </div>
                                      <div className="il-call-history__notes">
                                        <span>הערות נציג</span>
                                        <strong>{entry.agentNotes?.trim() || "—"}</strong>
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showConflictModal ? (
          <div className="us-modal-backdrop" role="presentation">
            <div className="us-modal-card">
              <h2 className="us-modal-title">נמצאו מוזמנים עם מספר טלפון קיים</h2>
              <p className="us-login-subtitle us-login-subtitle--left">
                זוהו {importConflicts.length} רשומות חופפות. בחרו לכל רשומה האם להשאיר את הקיים או לעדכן לפי האקסל.
                לאחר מכן לחצו &quot;אשר והמשך שמירה&quot;.
                {pendingNewGuests.length > 0 ? <> בנוסף, {pendingNewGuests.length} מוזמנים חדשים יתווספו אוטומטית עם האישור.</> : null}
              </p>
              <div className="mt-4 space-y-4">
                {importConflicts.map((item) => (
                  <div key={item.phone} className="us-conflict-card">
                    <p className="us-dashboard-emphasis text-sm" dir="ltr">
                      {item.phone}
                      {item.rowNumber ? ` · שורה ${item.rowNumber}` : ""}
                    </p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                      <div>
                        <span className="us-dashboard-emphasis">מה קיים כרגע במערכת:</span> {item.existing.fullName} | כמות{" "}
                        {item.existing.attendeesCount} | מקור: {sourceLabel(item.existing.source)}
                      </div>
                      <div>
                        <span className="us-dashboard-emphasis">מה מנסים להעלות מהאקסל:</span> {item.excel.fullName} | כמות{" "}
                        {item.excel.attendeesCount}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                      <label>
                        <input
                          type="radio"
                          name={`conflict-${item.phone}`}
                          checked={(conflictChoices[item.phone] || "keep_existing") === "keep_existing"}
                          onChange={() => setConflictChoice(item.phone, "keep_existing")}
                        />{" "}
                        🔹 השאר את הקיים
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`conflict-${item.phone}`}
                          checked={conflictChoices[item.phone] === "use_excel"}
                          onChange={() => setConflictChoice(item.phone, "use_excel")}
                        />{" "}
                        🔸 עדכן לפי האקסל החדש
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="button" disabled={importSubmitting} onClick={applyConflictResolutions}>
                  {importSubmitting ? "שומר…" : "אשר והמשך שמירה"}
                </button>
                <button className="us-btn" type="button" onClick={closeConflictModal}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {importSummary ? (
          <div className="us-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-summary-title">
            <div className="us-modal-card us-import-summary-card">
              <h2 className="us-modal-title" id="import-summary-title">
                העלאת הקובץ הושלמה!
              </h2>
              <p className="us-import-summary-text">
                סך הכל הועלו בהצלחה:{" "}
                <strong>
                  {importSummary.uploadedCount} מתוך {importSummary.totalCount}
                </strong>{" "}
                מוזמנים.
              </p>
              {importSummary.failedRows?.length ? (
                <div className="us-import-failed">
                  <p className="us-import-failed__title">השורות הבאות לא עלו למערכת:</p>
                  <ul className="us-import-failed__list">
                    {importSummary.failedRows.map((item, index) => (
                      <li key={`fail-${item.rowNumber}-${item.reason}-${index}`}>{formatFailedRowLabel(item)}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="us-import-summary-ok">כל השורות התקינות נשמרו בהצלחה.</p>
              )}
              {importSummary.warningRows?.length ? (
                <div className="us-import-warnings">
                  <p className="us-import-warnings__title">שימו לב — השורות הבאות עלו, אך כדאי לוודא את המספר:</p>
                  <ul className="us-import-warnings__list">
                    {importSummary.warningRows.map((item, index) => (
                      <li key={`warn-${item.rowNumber}-${item.reason}-${index}`}>{formatFailedRowLabel(item)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="button" onClick={() => setImportSummary(null)}>
                  סגור
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showModal ? (
          <div className="us-modal-backdrop" role="presentation">
            <form className="us-modal-card" onSubmit={addManualGuest}>
              <h2 className="us-modal-title">הוספת רשומה ידנית</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="us-field-label" htmlFor="manual-fullName">
                    שם מלא
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
                  <label className="us-field-label" htmlFor="manual-phone">
                    טלפון
                  </label>
                  <input
                    id="manual-phone"
                    className="us-field-input"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    value={manualGuest.phone}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-attendeesCount">
                    כמות מגיעים
                  </label>
                  <input
                    id="manual-attendeesCount"
                    className="us-field-input"
                    name="attendeesCount"
                    type="number"
                    min="0"
                    value={manualGuest.attendeesCount}
                    onChange={onManualChange}
                    required
                  />
                </div>
                <div>
                  <label className="us-field-label" htmlFor="manual-giftAmount">
                    סכום מתנה (₪)
                  </label>
                  <input
                    id="manual-giftAmount"
                    className="us-field-input"
                    name="giftAmount"
                    type="number"
                    min="0"
                    value={manualGuest.giftAmount}
                    onChange={onManualChange}
                  />
                </div>
                <div>
                  <span className="us-field-label">סטטוס</span>
                  <div className="il-status-group mt-2" role="group" aria-label="סטטוס">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`il-status-btn ${manualGuest.status === option.value ? "is-selected" : ""}`}
                        onClick={() => setManualStatus(option.value)}
                        aria-pressed={manualGuest.status === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn us-btn--primary" type="submit">
                  שמירה
                </button>
                <button className="us-btn" type="button" onClick={() => setShowModal(false)}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {showBulkWhatsApp ? (
          <div className="us-modal-backdrop" role="presentation">
            <form className="us-modal-card il-bulk-whatsapp-modal" onSubmit={sendBulkWhatsApp}>
              <h2 className="us-modal-title">תפוצה רחבה — WhatsApp</h2>
              <p className="il-bulk-whatsapp-intro">
                על מנת לשלוח הודעות אישורי הגעה בתפוצה רחבה יש לרכוש את השירות. פנו למנהל המערכת וספקו קוד.
                <br />
                <strong>שימו לב:</strong> המספר נשלח מחברת momoEVENT.
              </p>
              {whatsappQuotas.length ? (
                <div className="il-bulk-whatsapp-quota">
                  <p style={{ margin: "0 0 0.45rem" }}>קופונים זמינים ללקוח זה:</p>
                  <ul style={{ margin: 0, paddingInlineStart: "1.1rem" }}>
                    {whatsappQuotas.map((item) => (
                      <li key={item.code}>
                        <strong>{item.code}</strong> · נותרו {item.remaining_credits} / {item.total_credits}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : whatsappQuota ? (
                <p className="il-bulk-whatsapp-quota">
                  מכסה פעילה: נותרו <strong>{whatsappQuota.remaining_credits}</strong> /{" "}
                  {whatsappQuota.total_credits} הודעות
                </p>
              ) : null}
              <div className="mt-4 space-y-4">
                <div>
                  <label className="us-field-label" htmlFor="bulk-payment-code">
                    קוד רכישה
                  </label>
                  {whatsappQuotas.length > 1 ? (
                    <select
                      id="bulk-payment-code"
                      className="us-field-input"
                      value={paymentCode}
                      onChange={(event) => setPaymentCode(event.target.value.toUpperCase())}
                      required
                    >
                      {whatsappQuotas.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code} ({item.remaining_credits}/{item.total_credits})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="bulk-payment-code"
                      className="us-field-input"
                      value={paymentCode}
                      onChange={(event) => setPaymentCode(event.target.value.toUpperCase())}
                      placeholder="הזינו את הקוד שקיבלתם מהמנהל"
                      required
                      autoComplete="off"
                    />
                  )}
                </div>
                <div>
                  <div className="il-bulk-whatsapp-editor-head">
                    <label className="us-field-label" htmlFor="wa-welcome-paragraph">
                      עריכת הודעת ההזמנה
                    </label>
                    {inviteCopySaveState === "saving" ? (
                      <span className="il-bulk-whatsapp-save-hint">שומר…</span>
                    ) : null}
                    {inviteCopySaveState === "saved" ? (
                      <span className="il-bulk-whatsapp-save-hint is-saved">נשמר</span>
                    ) : null}
                    {inviteCopySaveState === "error" ? (
                      <span className="il-bulk-whatsapp-save-hint is-error">שמירה נכשלה</span>
                    ) : null}
                  </div>
                  <IlWhatsAppInviteEditor
                    eventId={userId}
                    origin={window.location.origin}
                    value={inviteCopy}
                    onChange={onInviteCopyChange}
                  />
                </div>
                <p className="il-bulk-whatsapp-selected">
                  נבחרו לשליחה: <strong>{selectedCount}</strong> מוזמנים
                </p>
                {bulkWhatsAppError ? (
                  <div className="il-bulk-whatsapp-alert" role="alert">
                    <strong>שליחה נכשלה</strong>
                    <p>{bulkWhatsAppError}</p>
                  </div>
                ) : null}
                {bulkWhatsAppResult ? (
                  <div className="il-bulk-whatsapp-success-box" role="status">
                    <p>{bulkWhatsAppResult}</p>
                  </div>
                ) : null}
              </div>
              <div className="us-toolbar mt-4">
                <button className="us-btn il-bulk-send-btn" type="submit" disabled={bulkWhatsAppSending || !selectedCount}>
                  {bulkWhatsAppSending ? "שולח…" : `שליחה ל-${selectedCount} מוזמנים`}
                </button>
                <button className="us-btn" type="button" onClick={() => setShowBulkWhatsApp(false)}>
                  סגירה
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {selectedCount > 0 ? (
          <div className="il-bulk-action-bar" role="region" aria-label="פעולות קבוצתיות">
            <p className="il-bulk-action-bar-text">
              נבחרו <strong>{selectedCount}</strong> מוזמנים
            </p>
            <div className="il-bulk-action-bar-actions">
              <button
                className="us-btn il-bulk-send-btn"
                type="button"
                onClick={openBulkWhatsApp}
              >
                שלח הודעה ל-{selectedCount} מוזמנים מסומנים
              </button>
              <button
                className="us-btn il-btn-danger"
                type="button"
                onClick={requestBulkDelete}
              >
                מחק {selectedCount} מוזמנים
              </button>
              <button className="us-btn" type="button" onClick={() => setSelectedGuestIds(new Set())}>
                ביטול בחירה
              </button>
            </div>
          </div>
        ) : null}

        {deleteConfirm ? (
          <div className="us-modal-backdrop" role="presentation">
            <div className="us-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-guests-title">
              <h2 id="delete-guests-title" className="us-modal-title">
                אישור מחיקה
              </h2>
              <p className="us-login-subtitle us-login-subtitle--left">
                {deleteConfirm.mode === "single"
                  ? `למחוק את המוזמן "${deleteConfirm.label}"? לא ניתן לבטל פעולה זו.`
                  : `למחוק ${deleteConfirm.label} שנבחרו? לא ניתן לבטל פעולה זו.`}
              </p>
              <div className="us-toolbar mt-4">
                <button
                  className="us-btn il-btn-danger"
                  type="button"
                  disabled={deletingGuests}
                  onClick={confirmDeleteGuests}
                >
                  {deletingGuests ? "מוחק…" : "מחיקה"}
                </button>
                <button
                  className="us-btn"
                  type="button"
                  disabled={deletingGuests}
                  onClick={closeDeleteConfirm}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showInvitationEditor && eventInfo ? (
          <IlInvitationEditor
            userId={userId}
            eventInfo={eventInfo}
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
