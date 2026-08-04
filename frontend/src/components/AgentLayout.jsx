import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Phone, FolderKanban, LogOut } from "lucide-react";
import { clearAgentToken, getAgentProfile } from "../utils/agentAuth";
import "../agent-workspace.css";

const TABS = [
  { to: "/agent", end: true, label: "דשבורד", icon: LayoutDashboard },
  { to: "/agent/calls", end: false, label: "שיחות", icon: Phone },
  { to: "/agent/events", end: false, label: "אירועים", icon: FolderKanban }
];

export default function AgentLayout() {
  const navigate = useNavigate();
  const profile = getAgentProfile();

  const logout = () => {
    clearAgentToken();
    navigate("/agent/login", { replace: true });
  };

  return (
    <div className="agent-shell agent-shell--nav" dir="rtl">
      <div className="agent-layout-top">
        <div className="agent-layout-top__meta">
          <span className="agent-layout-top__brand">momoEVENT · נציג</span>
          {profile?.displayName || profile?.username ? (
            <span className="agent-layout-top__user">{profile.displayName || profile.username}</span>
          ) : null}
        </div>
        <button type="button" className="agent-layout-logout" onClick={logout} aria-label="יציאה">
          <LogOut size={18} />
          <span>יציאה</span>
        </button>
      </div>

      <div className="agent-layout-body">
        <Outlet />
      </div>

      <nav className="agent-bottom-nav" aria-label="ניווט נציג">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `agent-bottom-nav__item${isActive ? " agent-bottom-nav__item--active" : ""}`
              }
            >
              <Icon size={22} strokeWidth={2.2} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
