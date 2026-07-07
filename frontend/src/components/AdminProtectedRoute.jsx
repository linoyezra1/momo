import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";
import { clearAdminToken, getAdminToken } from "../utils/adminAuth";

export default function AdminProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => (getAdminToken() ? "checking" : "guest"));

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setStatus("guest");
      return;
    }

    let cancelled = false;
    api
      .get("/admin/session")
      .then(() => {
        if (!cancelled) setStatus("authed");
      })
      .catch(() => {
        clearAdminToken();
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
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
