import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { setAgentProfile, setAgentToken } from "../utils/agentAuth";
import "../agent-workspace.css";

export default function AgentLoginPage() {
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
      const response = await api.post("/agent/login", { username, password });
      setAgentToken(response.data?.token || "");
      setAgentProfile(response.data?.agent || null);
      navigate(location.state?.from || "/agent", { replace: true });
    } catch (submitError) {
      setError(submitError.response?.data?.message || "שם משתמש או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="agent-shell agent-login-shell" dir="rtl">
      <div className="agent-login-card">
        <h1 className="agent-login-title">התחברות סוכן</h1>
        <p className="agent-login-subtitle">מרחב עבודה לניהול לקוחות ואישורי הגעה — momoEVENT</p>
        <form className="agent-login-form" onSubmit={onSubmit} noValidate>
          <div>
            <label className="agent-field-label" htmlFor="agent-username">
              שם משתמש
            </label>
            <input
              id="agent-username"
              className="agent-field-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="agent-field-label" htmlFor="agent-password">
              סיסמה
            </label>
            <input
              id="agent-password"
              className="agent-field-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="agent-btn agent-btn--primary" type="submit" disabled={loading}>
            {loading ? "מתחבר…" : "כניסה למערכת"}
          </button>
          {error ? <p className="agent-error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
