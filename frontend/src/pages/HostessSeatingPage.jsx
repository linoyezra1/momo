import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import api from "../api";
import IlSeatingCanvas from "../il/seating/IlSeatingCanvas.jsx";
import IlSeatingTableDetail from "../il/seating/IlSeatingTableDetail.jsx";
import "../il/hostess.css";
import "../il/seating/il-seating.css";

export default function HostessSeatingPage() {
  const { eventId } = useParams();
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventLabel, setEventLabel] = useState("");
  const [tables, setTables] = useState([]);
  const [venueElements, setVenueElements] = useState([]);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [hallPresetId, setHallPresetId] = useState("");
  const [guests, setGuests] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [activeTableId, setActiveTableId] = useState("");

  const loadSeating = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/hostess/${eventId}/seating`);
      setEventLabel(data.eventLabel || "");
      setTables(data.tables || data.layout?.tables || []);
      setVenueElements(data.venueElements || data.layout?.venueElements || []);
      setBackgroundImageUrl(data.backgroundImageUrl || data.layout?.backgroundImageUrl || "");
      setCanvasWidth(Number(data.canvasWidth || data.layout?.canvasWidth) || 0);
      setCanvasHeight(Number(data.canvasHeight || data.layout?.canvasHeight) || 0);
      setHallPresetId(data.hallPresetId || data.layout?.hallPresetId || "");
      setGuests(data.guests || []);
      setWarnings((data.warnings || []).filter((item) => item.type === "overfill"));
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מפת ההושבה נכשלה");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadSeating();
  }, [loadSeating]);

  const focusedTable = useMemo(
    () => tables.find((table) => table.tableId === activeTableId) || null,
    [activeTableId, tables]
  );

  const seatedGuests = useMemo(
    () => guests.filter((guest) => Boolean(guest.seatingTableId)),
    [guests]
  );

  const hasHallBackground = Boolean(String(backgroundImageUrl || "").trim());

  return (
    <div className="il-hostess-page il-hostess-seating-page" dir="rtl" lang="he">
      <div className="il-hostess-shell">
        <header className="il-hostess-header il-hostess-header--seating">
          <div className="il-hostess-header__inner">
            <div className="il-hostess-header__top">
              <div>
                <Link className="il-hostess-back-link" to={`/hostess/${eventId}`}>
                  <ArrowRight size={16} aria-hidden="true" />
                  חזרה לקבלת פנים
                </Link>
                <p className="il-hostess-eyebrow">מפת הושבה · צפייה בלבד</p>
                <h1>{eventLabel || "מפת הושבה"}</h1>
              </div>
              <div className="il-hostess-seating-legend" aria-label="מקרא הגעה">
                <span className="il-hostess-seating-legend__item is-arrived">הגיע</span>
                <span className="il-hostess-seating-legend__item is-pending">טרם הגיע</span>
              </div>
            </div>
          </div>
        </header>

        <div className="il-hostess-body il-hostess-body--seating">
          {loading ? <p className="il-hostess-status-line">טוען מפת הושבה…</p> : null}
          {error ? <p className="il-hostess-status-line il-hostess-status-line--error">{error}</p> : null}

          {!loading && !error ? (
            <>
              <p className="il-hostess-seating-hint-line">
                לחצו על שולחן כדי לראות מי משובץ בו. אין אפשרות לעריכה או גרירה.
              </p>
              <div className="il-seat-canvas-stage il-hostess-seating-stage">
                {!tables.length ? (
                  <p className="il-hostess-status-line">עדיין אין פריסת שולחנות לאירוע זה</p>
                ) : (
                  <IlSeatingCanvas
                    tables={tables}
                    venueElements={venueElements}
                    guests={seatedGuests}
                    warnings={warnings}
                    activeTableId={activeTableId}
                    onSelectTable={setActiveTableId}
                    canvasRef={canvasRef}
                    readOnly
                    backgroundImageUrl={hasHallBackground ? backgroundImageUrl : ""}
                    canvasWidth={hasHallBackground ? canvasWidth : 0}
                    canvasHeight={hasHallBackground ? canvasHeight : 0}
                    hallPresetId={hasHallBackground ? hallPresetId : ""}
                  />
                )}

                {focusedTable ? (
                  <IlSeatingTableDetail
                    table={focusedTable}
                    guests={seatedGuests}
                    onClose={() => setActiveTableId("")}
                    showArrivalStatus
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
