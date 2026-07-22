import { Link, useParams } from "react-router-dom";
import GuestAuditLogTable from "../components/GuestAuditLogTable.jsx";
import "../us/client-portal.css";
import "../il/il-portal.css";

export default function ClientAuditLogPage() {
  const { userId } = useParams();

  return (
    <div
      className="us-client-portal il-client-portal il-audit-log-page us-dashboard-shell"
      dir="rtl"
      lang="he"
    >
      <div className="us-dashboard-content">
        <header className="il-audit-log-page__header">
          <div className="il-audit-log-page__intro">
            <h1>לוג עדכונים</h1>
            <p>מעקב בזמן אמת אחר שינויי סטטוס, כמות מגיעים ושיחות טלפון לכל מוזמן.</p>
          </div>
          <Link className="us-btn us-btn--primary il-audit-log-page__back" to={`/client/dashboard/${userId}`}>
            חזרה לדף הראשי
          </Link>
        </header>

        <GuestAuditLogTable userId={userId} enableLiveUpdates showHeader={false} fullPage />
      </div>
    </div>
  );
}
