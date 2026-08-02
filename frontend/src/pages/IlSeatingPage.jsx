import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, CircleHelp, Maximize2, Minimize2, Send } from "lucide-react";
import api from "../api";
import IlSeatingGuestPanel from "../il/seating/IlSeatingGuestPanel.jsx";
import IlSeatingSimpleGrid from "../il/seating/IlSeatingSimpleGrid.jsx";
import IlSeatingCanvas from "../il/seating/IlSeatingCanvas.jsx";
import IlSeatingTableEditModal from "../il/seating/IlSeatingTableEditModal.jsx";
import { TABLE_SHAPES, VENUE_ELEMENT_TYPES, getVenueElementDefaults } from "../il/seating/seatingConstants.js";
import { buildSeatingExportRows, filterSeatingGuests, formatTableDisplayLabel, makeSeatingId } from "../il/seating/ilSeatingUtils.js";
import { useSeatingDragAutoScroll } from "../il/seating/useSeatingDragAutoScroll.js";
import { useSeatingTouchDrag } from "../il/seating/useSeatingTouchDrag.js";
import { useEventWorkspace } from "../utils/useEventWorkspace.js";
import TableDispatchFeatureLockedNotice from "../components/TableDispatchFeatureLockedNotice.jsx";
import CouponCodeField from "../components/CouponCodeField.jsx";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/seating/il-seating.css";
import "../il/manager-event.css";

const initialFilters = { query: "" };

function defaultDispatchDateTimeLocal() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse datetime-local value as local wall-clock (avoid UTC mis-parse). */
function parseDateTimeLocalValue(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(year, month, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateTimeValue(iso) {
  if (!iso) return defaultDispatchDateTimeLocal();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return defaultDispatchDateTimeLocal();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function IlSeatingPage() {
  const { userId } = useParams();
  const { isManagerEvent, backPath, backLabel, basePath } = useEventWorkspace();
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tables, setTables] = useState([]);
  const [venueElements, setVenueElements] = useState([]);
  const [guests, setGuests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedGuestIds, setSelectedGuestIds] = useState(() => new Set());
  const [activeTableId, setActiveTableId] = useState("");
  const [editingTableId, setEditingTableId] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchError, setDispatchError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDispatchDateTimeLocal);
  const [canSendTableWhatsApp, setCanSendTableWhatsApp] = useState(false);
  const [tableDispatch, setTableDispatch] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [viewMode, setViewMode] = useState("simple");
  const [canvasFullscreen, setCanvasFullscreen] = useState(false);
  const { startDragAutoScroll } = useSeatingDragAutoScroll();
  const assignGuestsRef = useRef(null);

  const resolveTouchGuestIds = useCallback(
    (guestId) => (selectedGuestIds.has(guestId) ? [...selectedGuestIds] : [guestId]),
    [selectedGuestIds]
  );

  const { touchDrag, onGuestPointerDown } = useSeatingTouchDrag({
    resolveGuestIds: resolveTouchGuestIds,
    onDropGuestsOnTable: (tableId, guestIds) => assignGuestsRef.current?.(guestIds, tableId)
  });

  const tableLabelById = useMemo(
    () =>
      new Map(
        tables.map((table) => [
          table.tableId,
          formatTableDisplayLabel(table)
        ])
      ),
    [tables]
  );

  const guestsWithLabels = useMemo(
    () =>
      guests.map((guest) => ({
        ...guest,
        tableLabel: guest.seatingTableId ? tableLabelById.get(guest.seatingTableId) || "?" : ""
      })),
    [guests, tableLabelById]
  );

  const eligibleGuests = useMemo(
    () => guestsWithLabels.filter((guest) => guest.isEligible || guest.isDeclinedWhileSeated),
    [guestsWithLabels]
  );

  const editingTable = useMemo(
    () => tables.find((table) => table.tableId === editingTableId) || null,
    [tables, editingTableId]
  );

  const kpi = useMemo(() => {
    const invited = Number(analytics?.totalInvitedSeats ?? guestsWithLabels.filter((g) => g.isEligible).length);
    const seated = Number(analytics?.seatedSeats ?? guestsWithLabels.filter((g) => g.isSeated && g.isEligible).length);
    return {
      forSeating: invited,
      seated,
      waiting: Math.max(0, invited - seated),
      activeTables: Number(analytics?.tableCount ?? tables.length)
    };
  }, [analytics, guestsWithLabels, tables.length]);

  const loadSeating = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/client/${userId}/seating`);
      setTables(response.data.layout?.tables || response.data.tables || []);
      setVenueElements(response.data.layout?.venueElements || response.data.venueElements || []);
      setGuests(response.data.guests || []);
      setAnalytics(response.data.analytics || null);
      setWarnings((response.data.warnings || []).filter((item) => item.type === "overfill"));
      setCanSendTableWhatsApp(Boolean(response.data.features?.canSendTableWhatsApp));
      setTableDispatch(response.data.tableDispatch || null);
      setEventInfo(response.data.event || null);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מערכת ההושבה נכשלה");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSeating();
  }, [loadSeating]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saveLayout = useCallback(
    async (patch) => {
      const nextTables = patch.tables ?? tables;
      const nextVenueElements = patch.venueElements ?? venueElements;
      setTables(nextTables);
      setVenueElements(nextVenueElements);
      setSaving(true);
      try {
        const response = await api.put(`/client/${userId}/seating/layout`, {
          tables: nextTables,
          venueElements: nextVenueElements
        });
        setWarnings((response.data.warnings || []).filter((item) => item.type === "overfill"));
      } catch (saveError) {
        setToast(saveError.response?.data?.message || "שמירת פריסה נכשלה");
      } finally {
        setSaving(false);
      }
    },
    [tables, userId, venueElements]
  );

  async function assignGuests(guestIds, tableId) {
    if (!guestIds.length || !tableId) return;
    try {
      const response = await api.patch(`/client/${userId}/seating/assign`, {
        assignments: guestIds.map((guestId) => ({ guestId, tableId }))
      });
      setGuests(response.data.guests || []);
      setWarnings((response.data.warnings || []).filter((item) => item.type === "overfill"));
      setAnalytics(response.data.analytics || null);
      setSelectedGuestIds(new Set());
      setToast(`שובצו ${guestIds.length} אורחים`);
    } catch (assignError) {
      setToast(assignError.response?.data?.message || "שיבוץ נכשל");
    }
  }
  assignGuestsRef.current = assignGuests;

  async function unassignGuestIds(guestIds) {
    if (!guestIds.length) return;
    try {
      const response = await api.patch(`/client/${userId}/seating/assign`, {
        unassignGuestIds: guestIds
      });
      setGuests(response.data.guests || []);
      setWarnings((response.data.warnings || []).filter((item) => item.type === "overfill"));
      setAnalytics(response.data.analytics || null);
      setSelectedGuestIds(new Set());
      setToast("האורחים הוסרו מהשולחן");
    } catch (unassignError) {
      setToast(unassignError.response?.data?.message || "הסרת שיבוץ נכשלה");
    }
  }

  async function unassignSelected() {
    if (!selectedGuestIds.size) return;
    await unassignGuestIds([...selectedGuestIds]);
  }

  function addTable(shape = "round") {
    const label = String(tables.length + 1);
    const newTable = {
      tableId: makeSeatingId("tbl"),
      label,
      name: "",
      shape,
      capacity: 10,
      x: 60 + tables.length * 24,
      y: 120 + tables.length * 16,
      width: 120,
      height: 120
    };
    saveLayout({ tables: [...tables, newTable] });
  }

  function addVenueElement(type) {
    const defaults = getVenueElementDefaults(type);
    const offset = venueElements.length * 18;
    const newElement = {
      elementId: makeSeatingId("venue"),
      type,
      label: defaults.label,
      x: 80 + offset,
      y: 60 + offset,
      width: defaults.width,
      height: defaults.height,
      rotation: 0
    };
    saveLayout({ venueElements: [...venueElements, newElement] });
  }

  function onDragStart(event, guestId) {
    const guestIds = selectedGuestIds.has(guestId) ? [...selectedGuestIds] : [guestId];
    event.dataTransfer.setData("application/json", JSON.stringify({ guestIds }));
    event.dataTransfer.effectAllowed = "move";
    startDragAutoScroll(event);
  }

  function toggleGuest(guestId) {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filtered = filterSeatingGuests(guestsWithLabels, filters);
    const allSelected = filtered.every((guest) => selectedGuestIds.has(guest._id));
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((guest) => next.delete(guest._id));
      else filtered.forEach((guest) => next.add(guest._id));
      return next;
    });
  }

  async function exportSeatingExcel() {
    setActionsOpen(false);
    const { perTable, alphabetical } = buildSeatingExportRows(
      guestsWithLabels.filter((guest) => guest.isEligible || guest.isSeated),
      tables
    );
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(perTable), "לפי שולחן");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(alphabetical), "אלפביתי");
    XLSX.writeFile(workbook, "seating-export.xlsx");
  }

  function saveEditedTable({ label, name, capacity }) {
    if (!editingTable) return;
    saveLayout({
      tables: tables.map((item) =>
        item.tableId === editingTable.tableId ? { ...item, label, name, capacity } : item
      )
    });
    setEditingTableId("");
    setToast("פרטי השולחן עודכנו");
  }

  function deleteEditedTable() {
    if (!editingTable) return;
    const hasGuests = guestsWithLabels.some((guest) => guest.seatingTableId === editingTable.tableId);
    if (hasGuests) {
      setToast("לא ניתן למחוק שולחן שיש בו מוזמנים");
      return;
    }
    saveLayout({
      tables: tables.filter((item) => item.tableId !== editingTable.tableId)
    });
    setActiveTableId((prev) => (prev === editingTable.tableId ? "" : prev));
    setEditingTableId("");
    setToast("השולחן נמחק");
  }

  function openDispatchModal({ preserveSchedule = false } = {}) {
    setDispatchError("");
    setCouponCode("");
    if (preserveSchedule && tableDispatch?.status === "scheduled") {
      setScheduledAt(toLocalDateTimeValue(tableDispatch.scheduledAt));
    } else {
      setScheduledAt(defaultDispatchDateTimeLocal());
    }
    setDispatchOpen(true);
    setActionsOpen(false);
  }

  async function toggleCanvasFullscreen() {
    const node = canvasRef.current?.closest?.(".il-seat-canvas-fullscreen-host") || canvasRef.current;
    if (!node) return;
    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen?.();
        setCanvasFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setCanvasFullscreen(false);
      }
    } catch {
      setToast("לא ניתן להפעיל מסך מלא בדפדפן זה");
    }
  }

  useEffect(() => {
    const onFullscreenChange = () => {
      setCanvasFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function submitTableDispatch(event) {
    event.preventDefault();
    setDispatchSaving(true);
    setDispatchError("");
    try {
      if (!canSendTableWhatsApp) {
        setDispatchError("");
        setDispatchSaving(false);
        return;
      }
      if (!couponCode.trim()) {
        setDispatchError("יש להזין קוד קופון לרכישה זו");
        setDispatchSaving(false);
        return;
      }
      const scheduledDate = parseDateTimeLocalValue(scheduledAt);
      if (!scheduledDate) {
        setDispatchError("שעת השליחה אינה תקינה");
        setDispatchSaving(false);
        return;
      }
      const sendNow = scheduledDate.getTime() <= Date.now();
      const { data } = await api.post(`/client/${userId}/seating/send-table-messages`, {
        paymentCode: couponCode.trim(),
        couponCode: couponCode.trim(),
        scheduledAt: sendNow ? undefined : scheduledDate.toISOString(),
        sendNow
      });
      setTableDispatch(data.tableDispatch || null);
      setDispatchOpen(false);
      setToast(data.message || (data.scheduled ? "השליחה תוזמנה" : "השליחה בוצעה"));
    } catch (dispatchErr) {
      setDispatchError(dispatchErr.response?.data?.message || "שליחת מספרי שולחן נכשלה");
    } finally {
      setDispatchSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="il-seat-page il-seat-page--state il-seat-page--white" dir="rtl" lang="he">
        <p>טוען מערכת הושבה…</p>
      </div>
    );
  }

  return (
    <div
      className={`il-seat-page il-client-portal il-seat-page--white${viewMode === "simple" ? " is-simple-view" : " is-canvas-view"}`}
      dir="rtl"
      lang="he"
    >
      <header className="il-seat-header">
        <div>
          <h1>מערכת הושבה — momoEVENT</h1>
          <p>גררו אורחים לשולחנות · ניהול הושבה לאירוע</p>
        </div>
        <div className="il-seat-header__actions">
          <div className="il-seat-view-toggle" role="group" aria-label="בחירת תצוגה">
            <button
              type="button"
              className={viewMode === "simple" ? "is-active" : ""}
              onClick={() => setViewMode("simple")}
            >
              תצוגת שולחנות
            </button>
            <button
              type="button"
              className={viewMode === "canvas" ? "is-active" : ""}
              onClick={() => setViewMode("canvas")}
            >
              תצוגת קאנבס האולם
            </button>
          </div>
          <button
            type="button"
            className="il-seat-help-btn"
            onClick={() => setHelpOpen(true)}
            aria-label="עזרה לדיילת דיגיטלית"
            title="עזרה"
          >
            <CircleHelp size={18} aria-hidden="true" />
            ?
          </button>
          <Link className="us-btn" to={`/hostess/${userId}`} target="_blank" rel="noreferrer">
            דיילת דיגיטלית
          </Link>
          {!isManagerEvent ? (
            <Link className="us-btn" to={backPath}>
              {backLabel}
            </Link>
          ) : (
            <Link className="us-btn" to={basePath}>
              חזרה למוזמנים
            </Link>
          )}
        </div>
      </header>

      {error ? <p className="us-error-message">{error}</p> : null}
      {toast ? <p className="il-seat-toast">{toast}</p> : null}
      {saving ? <p className="il-seat-saving">שומר פריסה…</p> : null}
      {tableDispatch?.status === "scheduled" && tableDispatch.scheduledAt ? (
        <p className="il-seat-schedule-note" role="status">
          שליחת מספרי שולחן מתוזמנת ל-
          {new Date(tableDispatch.scheduledAt).toLocaleString("he-IL")}
          {" · "}
          <button
            type="button"
            className="il-seat-schedule-note__edit"
            onClick={() => openDispatchModal({ preserveSchedule: true })}
          >
            עדכון זמן שליחה
          </button>
        </p>
      ) : null}

      <div className="il-seat-kpi-bar" aria-label="מדדי הושבה">
        <div>
          <span>אורחים לשיבוץ</span>
          <strong>{kpi.forSeating}</strong>
        </div>
        <div>
          <span>אורחים משובצים</span>
          <strong>{kpi.seated}</strong>
        </div>
        <div>
          <span>ממתינים לשיבוץ</span>
          <strong>{kpi.waiting}</strong>
        </div>
        <div>
          <span>שולחנות פעילים</span>
          <strong>{kpi.activeTables}</strong>
        </div>
      </div>

      {warnings.length ? (
        <ul className="il-seat-warnings">
          {warnings.map((warning) => (
            <li key={`${warning.tableId}-${warning.type}`} className="il-seat-warnings__item--overfill">
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="il-seat-command-bar">
        <div className="il-seat-toolbox" aria-label="הוספת שולחנות ואלמנטים">
          <div className="il-seat-toolbox__group">
            <span>שולחנות</span>
            {viewMode === "canvas" ? (
              TABLE_SHAPES.filter((shape) => shape.value !== "head").map((shape) => (
                <button key={shape.value} type="button" onClick={() => addTable(shape.value)}>
                  {shape.label}
                </button>
              ))
            ) : (
              <button type="button" onClick={() => addTable("round")}>
                הוסף שולחן
              </button>
            )}
          </div>
          {viewMode === "canvas" ? (
            <div className="il-seat-toolbox__group">
              <span>אלמנטי אולם</span>
              {VENUE_ELEMENT_TYPES.map((element) => (
                <button key={element.value} type="button" onClick={() => addVenueElement(element.value)}>
                  {element.label}
                </button>
              ))}
            </div>
          ) : null}
          {viewMode === "canvas" ? (
            <button type="button" className="il-seat-toolbox__primary" onClick={toggleCanvasFullscreen}>
              {canvasFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
              {canvasFullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
            </button>
          ) : null}
          <button type="button" className="il-seat-toolbox__primary" onClick={() => openDispatchModal()}>
            <Send size={15} aria-hidden="true" />
            שלח למוזמן מס׳ שולחן
          </button>
        </div>

        <div className="il-seat-actions-menu">
          <button
            type="button"
            className="il-seat-actions-menu__trigger"
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((open) => !open)}
          >
            פעולות
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {actionsOpen ? (
            <div className="il-seat-actions-menu__panel">
              <button type="button" onClick={exportSeatingExcel}>
                ייצוא Excel
              </button>
              {selectedGuestIds.size ? (
                <button type="button" onClick={unassignSelected}>
                  הסרת שיבוץ לנבחרים
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="il-seat-layout">
        <IlSeatingGuestPanel
          guests={guestsWithLabels}
          filters={filters}
          onFiltersChange={setFilters}
          selectedGuestIds={selectedGuestIds}
          onToggleGuest={toggleGuest}
          onToggleAll={toggleAllFiltered}
          onDragStart={onDragStart}
          onGuestPointerDown={onGuestPointerDown}
          compact
        />

        {viewMode === "simple" ? (
          <IlSeatingSimpleGrid
            tables={tables}
            guests={eligibleGuests}
            activeTableId={activeTableId}
            onSelectTable={setActiveTableId}
            onEditTable={setEditingTableId}
            onDropGuestsOnTable={(tableId, guestIds) => assignGuests(guestIds, tableId)}
            onUnassignGuest={(guestId) => unassignGuestIds([guestId])}
            touchOverTableId={touchDrag?.overTableId || ""}
          />
        ) : (
          <div className="il-seat-canvas-fullscreen-host">
            <IlSeatingCanvas
              tables={tables}
              venueElements={venueElements}
              guests={eligibleGuests}
              warnings={warnings}
              activeTableId={activeTableId}
              onLayoutChange={saveLayout}
              onSelectTable={setActiveTableId}
              onEditTable={setEditingTableId}
              onDropGuestsOnTable={(tableId, guestIds) => assignGuests(guestIds, tableId)}
              canvasRef={canvasRef}
              readOnly={false}
              touchOverTableId={touchDrag?.overTableId || ""}
            />
          </div>
        )}
      </div>

      {touchDrag ? (
        <div
          className="il-seat-touch-ghost"
          style={{ left: touchDrag.x, top: touchDrag.y }}
          aria-hidden="true"
        >
          גרירה · {touchDrag.guestIds.length}
        </div>
      ) : null}

      {editingTable ? (
        <IlSeatingTableEditModal
          table={editingTable}
          guests={eligibleGuests}
          onClose={() => setEditingTableId("")}
          onSave={saveEditedTable}
          onDelete={deleteEditedTable}
        />
      ) : null}

      {helpOpen ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}>
          <div
            className="us-modal-card"
            role="dialog"
            aria-modal="true"
            dir="rtl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="us-modal-title">דיילת דיגיטלית</h2>
            <p>
              שימו מישהו מטעמכם על העמדה והוא מחפש את המוזמן ויודע איפה הוא יושב.
            </p>
            <p>
              הדיילת מחפשת את המוזמן ← לוחצת הגיע ← קופצת הודעה איפה יושב ← המוזמן מוכוון לשולחן.
            </p>
            <button className="us-btn us-btn--primary" type="button" onClick={() => setHelpOpen(false)}>
              סגור
            </button>
          </div>
        </div>
      ) : null}

      {dispatchOpen ? (
        <div className="us-modal-backdrop" role="presentation" onClick={() => setDispatchOpen(false)}>
          <form
            className="us-modal-card il-table-dispatch-modal"
            dir="rtl"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitTableDispatch}
          >
            <h2 className="us-modal-title">
              {tableDispatch?.status === "scheduled" ? "עדכון שליחת מס׳ שולחן" : "שלח למוזמן מס׳ שולחן"}
            </h2>
            <p className="il-coupon-modal-intro">
              דיילת דיגיטלית — נשלח למוזמנים בשעה שתבחרו את מספר השולחן שלהם ב-WhatsApp, כדי
              להכווין אותם במהירות ביום האירוע.
              {tableDispatch?.status === "scheduled"
                ? " בעדכון לוח הזמנים יש להזין מחדש קוד קופון תקף."
                : ""}
            </p>
            {!canSendTableWhatsApp ? (
              <TableDispatchFeatureLockedNotice event={eventInfo} eventId={userId} />
            ) : (
              <div className="il-coupon-modal-fields">
                <label className="us-admin-field-label" htmlFor="table-dispatch-scheduled-at">
                  שעת שליחה
                  <input
                    id="table-dispatch-scheduled-at"
                    className="us-admin-field-input"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    required
                  />
                </label>
                <p className="il-coupon-modal-intro" style={{ marginTop: 0 }}>
                  זמן בעתיד = תזמון בלבד (ההודעות יישלחו אוטומטית בזמן שנבחר). זמן נוכחי/עבר =
                  שליחה מיידית.
                </p>
                <CouponCodeField
                  userId={userId}
                  value={couponCode}
                  onChange={setCouponCode}
                  label="קוד קופון"
                  hint="הכנס קוד קופון לרכישה זו — ניתן לבחור מקופון שמור או להקליד ידנית"
                  placeholder="לדוגמה: MOMO123"
                  id="table-dispatch-coupon"
                  required
                />
              </div>
            )}
            {dispatchError ? <p className="us-error-message">{dispatchError}</p> : null}
            <div className="us-modal-actions">
              {canSendTableWhatsApp ? (
                <button className="us-btn us-btn--primary" type="submit" disabled={dispatchSaving}>
                  {dispatchSaving ? "שולח…" : "אישור ושליחה"}
                </button>
              ) : null}
              <button className="us-btn" type="button" onClick={() => setDispatchOpen(false)}>
                {canSendTableWhatsApp ? "ביטול" : "סגור"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
