import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import IlSeatingCanvas from "../il/seating/IlSeatingCanvas.jsx";
import IlSeatingGuestPanel from "../il/seating/IlSeatingGuestPanel.jsx";
import { TABLE_SHAPES, VENUE_ELEMENT_TYPES } from "../il/seating/seatingConstants.js";
import { buildSeatingExportRows, filterSeatingGuests, makeSeatingId } from "../il/seating/ilSeatingUtils.js";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/seating/il-seating.css";

const initialFilters = { side: "", group: "", seated: "", query: "" };

export default function IlSeatingPage() {
  const { userId } = useParams();
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
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מערכת ההושבה נכשלה");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSeating();
  }, [loadSeating]);

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
    if (!guestIds.length) return;
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

  async function unassignSelected() {
    if (!selectedGuestIds.size) return;
    try {
      const response = await api.patch(`/client/${userId}/seating/assign`, {
        unassignGuestIds: [...selectedGuestIds]
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
      setGuests((prev) => prev.map((guest) => (guest._id === guestId ? { ...guest, ...patch, isSeated: Boolean(patch.seatingTableId ?? guest.seatingTableId) } : guest)));
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
      width: isHead ? 180 : 96,
      height: isHead ? 72 : 96
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
          <p>גרור ושחרר אורחים לשולחנות · סנכרון אוטומטי מ-RSVP</p>
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
          ייצוא Excel לאולם
        </button>
        <button className="us-btn il-bulk-send-btn" type="button" onClick={sendTableMessages}>
          שליחת מספר שולחן בוואטסאפ
        </button>
      </div>

      {activeTableId ? (
        <div className="il-seat-table-editor">
          {(() => {
            const table = tables.find((item) => item.tableId === activeTableId);
            if (!table) return null;
            return (
              <>
                <span>
                  עריכת שולחן <strong>{table.label}</strong>
                </span>
                <label>
                  תווית
                  <input
                    value={table.label}
                    onChange={(event) =>
                      saveLayout({
                        tables: tables.map((item) =>
                          item.tableId === activeTableId ? { ...item, label: event.target.value } : item
                        )
                      })
                    }
                  />
                </label>
                <label>
                  קיבולת
                  <input
                    type="number"
                    min="1"
                    value={table.capacity}
                    onChange={(event) =>
                      saveLayout({
                        tables: tables.map((item) =>
                          item.tableId === activeTableId
                            ? { ...item, capacity: Math.max(1, Number(event.target.value) || 1) }
                            : item
                        )
                      })
                    }
                  />
                </label>
              </>
            );
          })()}
        </div>
      ) : null}

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
        <button className="us-btn us-btn--primary" type="button" onClick={assignGroupToTable} disabled={!selectedGuestIds.size || !groupAssignTableId}>
          שיבוץ קבוצה לשולחן
        </button>
        <button className="us-btn" type="button" onClick={unassignSelected} disabled={!selectedGuestIds.size}>
          הסרת שיבוץ
        </button>
      </div>

      <div className="il-seat-layout">
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
          guests={guestsWithLabels.filter((guest) => guest.isEligible)}
          warnings={warnings}
          activeTableId={activeTableId}
          onLayoutChange={saveLayout}
          onSelectTable={setActiveTableId}
          onDropGuestsOnTable={assignGuests}
        />
      </div>
    </div>
  );
}
