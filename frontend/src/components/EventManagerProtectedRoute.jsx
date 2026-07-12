import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";
import { clearEventManagerToken, getEventManagerToken } from "../utils/eventManagerAuth";

export default function EventManagerProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => (getEventManagerToken() ? "checking" : "guest"));

  useEffect(() => {
    const token = getEventManagerToken();
    if (!token) {
      setStatus("guest");
      return;
    }

    let cancelled = false;
    api
      .get("/manager/session")
      .then(() => {
        if (!cancelled) setStatus("authed");
      })
      .catch(() => {
        clearEventManagerToken();
        if (!cancelled) setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="us-admin-portal us-admin-shell us-admin-auth-loading" dir="rtl">
        <p>בודק הרשאות…</p>
      </div>
    );
  }

  if (status !== "authed") {
    return <Navigate to="/manager/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
