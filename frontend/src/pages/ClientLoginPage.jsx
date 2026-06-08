import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../us/client-portal.css";
import "../il/il-portal.css";

export default function ClientLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/client/login", { username, password });
      navigate(`/client/dashboard/${response.data.userId}`, { state: response.data });
    } catch {
      setError("שם משתמש או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="us-client-portal il-client-portal us-login-shell" dir="rtl" lang="he">
      <div className="us-login-card il-login-card">
        <h1 className="us-login-title">כניסת לקוח</h1>
        <p className="us-login-subtitle">התחברות לדשבורד ניהול האורחים</p>

        <form className="mt-8" onSubmit={onSubmit} noValidate>
          <div className="mb-5">
            <label className="us-field-label" htmlFor="login-username">
              שם משתמש
            </label>
            <input
              id="login-username"
              className="us-field-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="mb-2">
            <label className="us-field-label" htmlFor="login-password">
              סיסמה
            </label>
            <input
              id="login-password"
              className="us-field-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="us-btn-primary" type="submit" disabled={loading}>
            {loading ? "מתחבר…" : "כניסה"}
          </button>
          {error ? <p className="us-error-message">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
