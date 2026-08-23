import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { Armchair, Bell, Briefcase, LayoutGrid, Settings, Users } from "lucide-react";
import api from "../api";
import BottomSheet from "./ui/BottomSheet.jsx";
import { getAuditLogLastReadAt, markAuditLogAsRead } from "../utils/auditLogUnread.js";
import { getGuestsListLabel, isConferenceEventType } from "../utils/eventTypeWording.js";
import { cn } from "../lib/utils.js";
import "../il/client-mobile-shell.css";

function navClassName({ isActive }) {
  return cn("client-bottom-nav__item", isActive && "is-active");
}

export default function ClientAppShell({ children }) {
  const { userId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [unreadLogCount, setUnreadLogCount] = useState(0);
  const [eventType, setEventType] = useState("");

  const basePath = `/client/dashboard/${userId}`;
  const auditPath = `${basePath}/audit-log`;
  const seatingPath = `${basePath}/seating`;
  const vendorsPath = `${basePath}/vendors`;
  const guestsNavLabel = getGuestsListLabel(eventType);

  const path = location.pathname.replace(/\/$/, "") || location.pathname;
  const isGuests = path === basePath;
  const isAudit = path.includes("/audit-log");
  const moreActive = moreOpen || path.includes("/seating") || path.includes("/vendors");

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    api
      .get(`/client/${userId}/guests`)
      .then((response) => {
        if (!cancelled) setEventType(response.data?.event?.eventType || "");
      })
      .catch(() => {
        if (!cancelled) setEventType("");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || isAudit) return undefined;
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const since = getAuditLogLastReadAt(userId);
        const response = await api.get(`/client/${userId}/audit-logs/unread-count`, {
          params: since ? { since } : {}
        });
        if (!cancelled) setUnreadLogCount(Number(response.data?.count) || 0);
      } catch {
        if (!cancelled) setUnreadLogCount(0);
      }
    }

    loadUnreadCount();
    return () => {
      cancelled = true;
    };
  }, [userId, location.pathname, isAudit]);

  useEffect(() => {
    if (!userId || isAudit) return undefined;
    const stream = new EventSource(`/api/client/${userId}/live-updates`);
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "guest-audit-log-updated") {
          setUnreadLogCount((prev) => prev + 1);
        }
      } catch {
        /* ignore keepalive/malformed payloads */
      }
    };
    return () => stream.close();
  }, [userId, isAudit]);

  useEffect(() => {
    if (isAudit && userId) {
      markAuditLogAsRead(userId);
      setUnreadLogCount(0);
    }
  }, [isAudit, userId]);

  function openEventSettings() {
    setMoreOpen(false);
    navigate(basePath, { state: { openInvitationEditor: true } });
  }

  return (
    <div className="client-app-shell" dir="rtl" lang="he">
      <div className="client-app-shell__frame">
        <div className="client-app-shell__content">{children}</div>

        <nav className="client-bottom-nav" aria-label="ניווט ראשי">
          <NavLink to={basePath} end className={navClassName} aria-current={isGuests ? "page" : undefined}>
            <Users size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>{guestsNavLabel}</span>
          </NavLink>

          <NavLink
            to={auditPath}
            className={navClassName}
            aria-current={isAudit ? "page" : undefined}
            onClick={() => setUnreadLogCount(0)}
          >
            <span className="client-bottom-nav__icon-wrap">
              <Bell size={22} strokeWidth={1.75} aria-hidden="true" />
              {unreadLogCount > 0 ? (
                <em className="client-bottom-nav__badge" aria-label={`${unreadLogCount} עדכונים שלא נקראו`}>
                  {unreadLogCount > 99 ? "99+" : unreadLogCount}
                </em>
              ) : null}
            </span>
            <span>עדכונים</span>
          </NavLink>

          <button
            type="button"
            className={cn("client-bottom-nav__item", moreActive && "is-active")}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <LayoutGrid size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>עוד</span>
          </button>
        </nav>

        <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="עוד">
          <div className="client-more-sheet">
            {!isConferenceEventType(eventType) ? (
              <NavLink className="client-more-sheet__item" to={seatingPath} onClick={() => setMoreOpen(false)}>
                <Armchair size={18} aria-hidden="true" />
                <span>הושבה / סידור שולחנות</span>
              </NavLink>
            ) : null}
            <NavLink className="client-more-sheet__item" to={vendorsPath} onClick={() => setMoreOpen(false)}>
              <Briefcase size={18} aria-hidden="true" />
              <span>ניהול ספקים</span>
            </NavLink>
            <button type="button" className="client-more-sheet__item" onClick={openEventSettings}>
              <Settings size={18} aria-hidden="true" />
              <span>עריכת הזמנה</span>
            </button>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
