import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { setAdminToken } from "../utils/adminAuth";
import "../us/admin-portal.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/admin/login", { username, password });
      setAdminToken(response.data?.token || "");
      const redirectTo = location.state?.from || "/admin";
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.response?.data?.message || "שם משתמש או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="us-admin-portal us-admin-shell us-admin-login-shell" dir="rtl">
      <div className="us-admin-login-card">
        <h1 className="us-admin-login-title">כניסת מנהל</h1>
        <p className="us-admin-login-subtitle">גישה מאובטחת למרכז ניהול momoEVENT</p>

        <form className="us-admin-login-form" onSubmit={onSubmit} noValidate>
          <div>
            <label className="us-admin-login-label" htmlFor="admin-username">
              שם משתמש
            </label>
            <input
              id="admin-username"
              className="us-admin-login-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="us-admin-login-label" htmlFor="admin-password">
              סיסמה
            </label>
            <input
              id="admin-password"
              className="us-admin-login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="us-admin-btn us-admin-btn--primary us-admin-login-submit" type="submit" disabled={loading}>
            {loading ? "מתחבר…" : "כניסה למערכת"}
          </button>
          {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}
        </form>

        <p className="us-admin-login-footer">
          <Link to="/">חזרה לדף הבית</Link>
        </p>
      </div>
    </div>
  );
}
