import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

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
    <div className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <h1>כניסת לקוח</h1>
          <p>התחברות לדשבורד ניהול האורחים</p>
        </header>

        <form className="card form-stack" onSubmit={onSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="login-username">
              שם משתמש
            </label>
            <input
              id="login-username"
              className="field-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="login-password">
              סיסמה
            </label>
            <input
              id="login-password"
              className="field-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "מתחבר…" : "כניסה"}
          </button>
          {error ? <p className="message message--error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
