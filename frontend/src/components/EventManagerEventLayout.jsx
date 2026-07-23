import { NavLink, Outlet, Link, useParams } from "react-router-dom";
import { Armchair, ClipboardList, Handshake, Wallet } from "lucide-react";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/manager-event.css";

const TABS = [
  { to: "vendors", end: false, label: "רשימת ספקים", icon: Handshake, emoji: "🤝" },
  { to: "budget", end: false, label: "תקציב ורווחיות", icon: Wallet, emoji: "💰" },
  { to: "seating", end: false, label: "סידורי הושבה", icon: Armchair, emoji: "🪑" },
  { to: "guests", end: false, label: "רשימת מוזמנים", icon: ClipboardList, emoji: "📋" }
];

export default function EventManagerEventLayout() {
  const { userId } = useParams();

  return (
    <div className="us-client-portal il-client-portal us-dashboard-shell il-manager-event" dir="rtl" lang="he">
      <div className="us-dashboard-content il-manager-event__shell">
        <header className="il-manager-event__top">
          <div>
            <p className="il-manager-event__eyebrow">תצוגת מנהל אירוע</p>
            <h1 className="il-manager-event__title">ניהול אירוע</h1>
          </div>
          <Link className="us-btn us-btn--primary" to="/manager">
            חזור
          </Link>
        </header>

        <nav className="il-manager-event__tabs" aria-label="ניווט מנהל אירוע">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `il-manager-event__tab${isActive ? " is-active" : ""}`
                }
              >
                <span aria-hidden="true">{tab.emoji}</span>
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="il-manager-event__outlet" data-event-id={userId}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
