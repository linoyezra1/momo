import { useEffect } from "react";
import { Link } from "react-router-dom";
import GuestAuditLogTable from "../components/GuestAuditLogTable.jsx";
import { markAuditLogAsRead } from "../utils/auditLogUnread.js";
import { useEventWorkspace } from "../utils/useEventWorkspace.js";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/manager-event.css";

export default function ClientAuditLogPage() {
  const { userId, isManagerEvent, basePath, backPath, backLabel } = useEventWorkspace();

  useEffect(() => {
    if (!userId) return;
    markAuditLogAsRead(userId);
  }, [userId]);

  return (
    <div
      className={
        isManagerEvent
          ? "il-audit-log-page"
          : "us-client-portal il-client-portal il-audit-log-page us-dashboard-shell"
      }
      dir="rtl"
      lang="he"
    >
      <div className={isManagerEvent ? undefined : "us-dashboard-content"}>
        <header className="il-audit-log-page__header">
          <div className="il-audit-log-page__intro">
            <h1>לוג עדכונים</h1>
            <p>מעקב בזמן אמת אחר שינויי סטטוס, כמות מגיעים ושיחות טלפון לכל מוזמן.</p>
          </div>
          {!isManagerEvent ? (
            <Link className="us-btn us-btn--primary il-audit-log-page__back" to={backPath}>
              {backLabel}
            </Link>
          ) : (
            <Link className="us-btn il-audit-log-page__back" to={basePath}>
              חזרה למוזמנים
            </Link>
          )}
        </header>

        <GuestAuditLogTable userId={userId} enableLiveUpdates showHeader={false} fullPage />
      </div>
    </div>
  );
}
