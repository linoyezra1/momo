import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import IlSeatingCanvas from "../il/seating/IlSeatingCanvas.jsx";
import IlSeatingGuestPanel from "../il/seating/IlSeatingGuestPanel.jsx";
import IlSeatingTablePanel from "../il/seating/IlSeatingTablePanel.jsx";
import { exportSeatingPdf } from "../il/seating/exportSeatingPdf.js";
import { TABLE_SHAPES, VENUE_ELEMENT_TYPES } from "../il/seating/seatingConstants.js";
import { buildSeatingExportRows, filterSeatingGuests, makeSeatingId } from "../il/seating/ilSeatingUtils.js";
import { getAdminToken } from "../utils/adminAuth.js";
import { getEventManagerToken } from "../utils/eventManagerAuth.js";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/seating/il-seating.css";

const initialFilters = { side: "", group: "", seated: "", query: "" };

function resolveTemplateOwnerRole() {
  if (getAdminToken()) return "admin";
  if (getEventManagerToken()) return "eventManager";
  return "admin";
}

export default function IlSeatingPage() {
  const { userId } = useParams();
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
  const [groupAssignTableId, setGroupAssignTableId] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [eventTitle, setEventTitle] = useState("תוכנית הושבה");
  const [exportingPdf, setExportingPdf] = useState(false);

  const tableLabelById = useMemo(
    () => new Map(tables.map((table) => [table.tableId, table.label])),
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
    () => guestsWithLabels.filter((guest) => guest.isEligible),
    [guestsWithLabels]
  );

  const unassignedGuests = useMemo(
    () => eligibleGuests.filter((guest) => !guest.isSeated),
    [eligibleGuests]
  );

  const activeTable = useMemo(
    () => tables.find((table) => table.tableId === activeTableId) || null,
    [tables, activeTableId]
  );

  const loadTemplates = useCallback(async () => {
    try {
      const response = await api.get("/seating-templates");
      setTemplates(response.data.templates || []);
    } catch {
      /* templates are optional */
    }
  }, []);

  const loadSeating = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/client/${userId}/seating`);
      setTables(response.data.layout?.tables || []);
      setVenueElements(response.data.layout?.venueElements || []);
      setGuests(response.data.guests || []);
      setAnalytics(response.data.analytics || null);
      setWarnings(response.data.warnings || []);
      const event = response.data.event;
      if (event?.eventNames) setEventTitle(event.eventNames);
      else if (event?.groomName || event?.brideName) {
        setEventTitle(`${event.groomName || ""} & ${event.brideName || ""}`.trim());
      }
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מערכת ההושבה נכשלה");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSeating();
    loadTemplates();
  }, [loadSeating, loadTemplates]);

  const saveLayout = useCallback(
    async (patch) => {
      const nextTables = patch.tables ?? tables;
      const nextElements = patch.venueElements ?? venueElements;
      setTables(nextTables);
      setVenueElements(nextElements);
      setSaving(true);
      try {
        const response = await api.put(`/client/${userId}/seating/layout`, {
          tables: nextTables,
          venueElements: nextElements
        });
        setWarnings(response.data.warnings || []);
      } catch (saveError) {
        setToast(saveError.response?.data?.message || "שמירת פריסה נכשלה");
      } finally {
        setSaving(false);
      }
    },
    [tables, venueElements, userId]
  );

  async function assignGuests(guestIds, tableId) {
    if (!guestIds.length || !tableId) return;
    try {
      const response = await api.patch(`/client/${userId}/seating/assign`, {
        assignments: guestIds.map((guestId) => ({ guestId, tableId }))
      });
      setGuests(response.data.guests || []);
      setWarnings(response.data.warnings || []);
      setAnalytics(response.data.analytics || null);
      setSelectedGuestIds(new Set());
      setToast(`שובצו ${guestIds.length} אורחים`);
    } catch (assignError) {
      setToast(assignError.response?.data?.message || "שיבוץ נכשל");
    }
  }

  async function unassignGuestIds(guestIds) {
    if (!guestIds.length) return;
    try {
      const response = await api.patch(`/client/${userId}/seating/assign`, {
        unassignGuestIds: guestIds
      });
      setGuests(response.data.guests || []);
      setWarnings(response.data.warnings || []);
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

  async function autoAssign() {
    try {
      const response = await api.post(`/client/${userId}/seating/auto-assign`);
      setGuests(response.data.guests || []);
      setWarnings(response.data.warnings || []);
      setAnalytics(response.data.analytics || null);
      setToast(response.data.message || "שיבוץ אוטומטי הושלם");
    } catch (autoError) {
      setToast(autoError.response?.data?.message || "שיבוץ אוטומטי נכשל");
    }
  }

  async function updateGuestMeta(guestId, patch) {
    try {
      await api.patch(`/client/${userId}/guests/${guestId}`, patch);
      setGuests((prev) =>
        prev.map((guest) =>
          guest._id === guestId
            ? { ...guest, ...patch, isSeated: Boolean(patch.seatingTableId ?? guest.seatingTableId) }
            : guest
        )
      );
    } catch (metaError) {
      setToast(metaError.response?.data?.message || "עדכון אורח נכשל");
    }
  }

  function addTable(shape = "round") {
    const label = String(tables.length + 1);
    const isHead = shape === "head";
    const newTable = {
      tableId: makeSeatingId("tbl"),
      label,
      shape,
      capacity: isHead ? 12 : 10,
      x: 60 + tables.length * 24,
      y: 120 + tables.length * 16,
      width: isHead ? 180 : 120,
      height: isHead ? 90 : 120
    };
    saveLayout({ tables: [...tables, newTable] });
  }

  function addVenueElement(type) {
    const element = {
      elementId: makeSeatingId("el"),
      type,
      label: VENUE_ELEMENT_TYPES.find((item) => item.value === type)?.label || "",
      x: 40,
      y: 40,
      width: type === "dance" ? 200 : 120,
      height: type === "pillar" ? 40 : 56
    };
    saveLayout({ venueElements: [...venueElements, element] });
  }

  function onDragStart(event, guestId) {
    const guestIds = selectedGuestIds.has(guestId) ? [...selectedGuestIds] : [guestId];
    event.dataTransfer.setData("application/json", JSON.stringify({ guestIds }));
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

  async function assignGroupToTable() {
    if (!groupAssignTableId || !selectedGuestIds.size) return;
    await assignGuests([...selectedGuestIds], groupAssignTableId);
  }

  async function exportSeatingExcel() {
    const { perTable, alphabetical } = buildSeatingExportRows(
      guestsWithLabels.filter((guest) => guest.isEligible),
      tables
    );
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(perTable), "לפי שולחן");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(alphabetical), "אלפביתי");
    XLSX.writeFile(workbook, "seating-export.xlsx");
  }

  async function exportPdf() {
    setExportingPdf(true);
    try {
      await exportSeatingPdf({
        canvasElement: canvasRef.current,
        guests: eligibleGuests,
        tables,
        eventTitle
      });
      setToast("קובץ PDF נוצר בהצלחה");
    } catch (pdfError) {
      setToast(pdfError.message || "ייצוא PDF נכשל");
    } finally {
      setExportingPdf(false);
    }
  }

  async function saveAsTemplate() {
    const name = templateName.trim();
    if (!name) {
      setToast("יש להזין שם לתבנית");
      return;
    }
    try {
      await api.post("/seating-templates", {
        name,
        ownerRole: resolveTemplateOwnerRole(),
        tables,
        venueElements
      });
      setTemplateName("");
      setToast(`התבנית "${name}" נשמרה`);
      await loadTemplates();
    } catch (saveError) {
      setToast(saveError.response?.data?.message || "שמירת תבנית נכשלה");
    }
  }

  async function applyTemplate(templateId) {
    if (!templateId) return;
    const template = templates.find((item) => String(item._id) === String(templateId));
    if (!template) return;
    const nextTables = (template.tables || []).map((table, index) => ({
      ...table,
      tableId: table.tableId || makeSeatingId("tbl"),
      label: table.label || String(index + 1)
    }));
    const nextElements = (template.venueElements || []).map((element) => ({
      ...element,
      elementId: element.elementId || makeSeatingId("el")
    }));
    const validTableIds = new Set(nextTables.map((table) => table.tableId));
    const staleGuestIds = guests
      .filter((guest) => guest.seatingTableId && !validTableIds.has(guest.seatingTableId))
      .map((guest) => guest._id);
    await saveLayout({ tables: nextTables, venueElements: nextElements });
    if (staleGuestIds.length) {
      await unassignGuestIds(staleGuestIds);
    }
    setActiveTableId("");
    setSelectedTemplateId(templateId);
    setToast(`נטענה תבנית: ${template.name}`);
  }

  async function sendTableMessages() {
    try {
      const response = await api.post(`/client/${userId}/seating/send-table-messages`, {});
      setToast(response.data.message || "הודעות נשלחו");
    } catch (sendError) {
      setToast(sendError.response?.data?.message || "שליחת הודעות שולחן נכשלה");
    }
  }

  if (loading) {
    return (
      <div className="il-seat-page il-seat-page--state" dir="rtl" lang="he">
        <p>טוען מערכת הושבה…</p>
      </div>
    );
  }

  return (
    <div className="il-seat-page il-client-portal" dir="rtl" lang="he">
      <header className="il-seat-header">
        <div>
          <h1>מערכת הושבה — momoEVENT</h1>
          <p>גרור אורחים לשולחנות · כיסא אדום = תפוס לפי כמות מגיעים</p>
        </div>
        <Link className="us-btn" to={`/client/dashboard/${userId}`}>
          חזרה לדשבורד
        </Link>
      </header>

      {error ? <p className="us-error-message">{error}</p> : null}
      {toast ? <p className="il-seat-toast">{toast}</p> : null}
      {saving ? <p className="il-seat-saving">שומר פריסה…</p> : null}

      {analytics ? (
        <div className="il-seat-analytics">
          <div>
            <span>שולחנות</span>
            <strong>{analytics.tableCount}</strong>
          </div>
          <div>
            <span>כיסאות פתוחים</span>
            <strong>{analytics.totalCapacity}</strong>
          </div>
          <div>
            <span>מוזמנים (מגיע/אולי)</span>
            <strong>{analytics.totalInvitedSeats}</strong>
          </div>
          <div>
            <span>מושבים</span>
            <strong>{analytics.seatedSeats}</strong>
          </div>
          <div>
            <span>צפים</span>
            <strong>{analytics.floatingSeats}</strong>
          </div>
          <div>
            <span>ניצול</span>
            <strong>{analytics.utilizationPercent}%</strong>
          </div>
        </div>
      ) : null}

      {warnings.length ? (
        <ul className="il-seat-warnings">
          {warnings.map((warning) => (
            <li key={`${warning.tableId}-${warning.type}`} className={`il-seat-warnings__item--${warning.type}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="il-seat-toolbar">
        <div className="il-seat-toolbar__group">
          <span>הוספת שולחן:</span>
          {TABLE_SHAPES.map((shape) => (
            <button key={shape.value} className="us-btn" type="button" onClick={() => addTable(shape.value)}>
              {shape.label}
            </button>
          ))}
        </div>
        <div className="il-seat-toolbar__group">
          <span>אלמנט אולם:</span>
          {VENUE_ELEMENT_TYPES.map((element) => (
            <button key={element.value} className="us-btn" type="button" onClick={() => addVenueElement(element.value)}>
              {element.label}
            </button>
          ))}
        </div>
        <button className="us-btn us-btn--primary" type="button" onClick={autoAssign}>
          שיבוץ אוטומטי לפי קבוצות
        </button>
        <button className="us-btn" type="button" onClick={exportSeatingExcel}>
          ייצוא Excel
        </button>
        <button className="us-btn us-btn--primary" type="button" onClick={exportPdf} disabled={exportingPdf}>
          {exportingPdf ? "מייצא PDF…" : "ייצוא PDF מלא"}
        </button>
        <button
          className="us-btn il-seating-wa-btn"
          type="button"
          onClick={sendTableMessages}
          disabled
          title="המערכת בהרצה — שליחת וואטסאפ אינה זמינה בשלב זה"
        >
          שליחת מספר שולחן בוואטסאפ
        </button>
      </div>

      <div className="il-seat-templates">
        <div className="il-seat-templates__save">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder='שם תבנית (לדוגמה: "אדיה — אולם קטן")'
          />
          <button className="us-btn" type="button" onClick={saveAsTemplate}>
            שמירה כתבנית
          </button>
        </div>
        <div className="il-seat-templates__load">
          <label htmlFor="il-seat-template-select">טעינת תבנית</label>
          <select
            id="il-seat-template-select"
            value={selectedTemplateId}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            <option value="">בחרו תבנית…</option>
            {templates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name} ({template.ownerRole === "eventManager" ? "מנהל אירועים" : "אדמין"} ·{" "}
                {template.tableCount} שולחנות)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="il-seat-group-bar">
        <span>הושבה קבוצתית: נבחרו {selectedGuestIds.size}</span>
        <select value={groupAssignTableId} onChange={(event) => setGroupAssignTableId(event.target.value)}>
          <option value="">בחרו שולחן</option>
          {tables.map((table) => (
            <option key={table.tableId} value={table.tableId}>
              שולחן {table.label} ({table.capacity})
            </option>
          ))}
        </select>
        <button
          className="us-btn us-btn--primary"
          type="button"
          onClick={assignGroupToTable}
          disabled={!selectedGuestIds.size || !groupAssignTableId}
        >
          שיבוץ קבוצה לשולחן
        </button>
        <button className="us-btn" type="button" onClick={unassignSelected} disabled={!selectedGuestIds.size}>
          הסרת שיבוץ
        </button>
      </div>

      <div className={`il-seat-layout${activeTable ? " il-seat-layout--with-panel" : ""}`}>
        <IlSeatingGuestPanel
          guests={guestsWithLabels}
          filters={filters}
          onFiltersChange={setFilters}
          selectedGuestIds={selectedGuestIds}
          onToggleGuest={toggleGuest}
          onToggleAll={toggleAllFiltered}
          onGuestMetaChange={updateGuestMeta}
          onDragStart={onDragStart}
        />
        <IlSeatingCanvas
          tables={tables}
          venueElements={venueElements}
          guests={eligibleGuests}
          warnings={warnings}
          activeTableId={activeTableId}
          onLayoutChange={saveLayout}
          onSelectTable={setActiveTableId}
          onDropGuestsOnTable={(tableId, guestIds) => assignGuests(guestIds, tableId)}
          canvasRef={canvasRef}
        />
        {activeTable ? (
          <IlSeatingTablePanel
            table={activeTable}
            guests={eligibleGuests}
            unassignedGuests={unassignedGuests}
            onClose={() => setActiveTableId("")}
            onRenameTable={(label) =>
              saveLayout({
                tables: tables.map((item) => (item.tableId === activeTable.tableId ? { ...item, label } : item))
              })
            }
            onCapacityChange={(capacity) =>
              saveLayout({
                tables: tables.map((item) =>
                  item.tableId === activeTable.tableId ? { ...item, capacity } : item
                )
              })
            }
            onUnassignGuest={(guestId) => unassignGuestIds([guestId])}
            onAssignGuest={(guestId) => assignGuests([guestId], activeTable.tableId)}
          />
        ) : null}
      </div>
    </div>
  );
}
