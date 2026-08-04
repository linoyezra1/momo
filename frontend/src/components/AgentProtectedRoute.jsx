import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";
import { clearAgentToken, getAgentToken, setAgentProfile } from "../utils/agentAuth";

export default function AgentProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => (getAgentToken() ? "checking" : "guest"));

  useEffect(() => {
    const token = getAgentToken();
    if (!token) {
      setStatus("guest");
      return;
    }

    let cancelled = false;
    api
      .get("/agent/session")
      .then((response) => {
        if (response.data?.agent) {
          setAgentProfile(response.data.agent);
        }
        if (!cancelled) setStatus("authed");
      })
      .catch(() => {
        clearAgentToken();
        if (!cancelled) setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="agent-shell agent-auth-loading" dir="rtl">
        <p>בודק הרשאות…</p>
      </div>
    );
  }

  if (status !== "authed") {
    return <Navigate to="/agent/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
