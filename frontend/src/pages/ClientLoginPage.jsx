import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  normalizeLoginPassword,
  normalizeLoginUsername
} from "../utils/loginCredentials.js";
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
      const cleanUsername = normalizeLoginUsername(username);
      const cleanPassword = normalizeLoginPassword(password);
      // Reflect cleaned values in the form (removes hidden WhatsApp newlines from the UI too)
      setUsername(cleanUsername);
      setPassword(cleanPassword);

      if (!cleanUsername || !cleanPassword) {
        setError("יש להזין שם משתמש וסיסמה");
        return;
      }

      const response = await api.post("/client/login", {
        username: cleanUsername,
        password: cleanPassword
      });
      navigate(`/client/dashboard/${response.data.userId}`, { state: response.data });
    } catch (loginError) {
      const status = loginError.response?.status;
      const serverMessage = String(loginError.response?.data?.message || "").trim();
      if (!loginError.response) {
        setError("לא ניתן להתחבר לשרת כרגע. בדקו את החיבור לאינטרנט ונסו שוב.");
      } else if (status === 401 || status === 400) {
        setError(
          !serverMessage ||
            serverMessage === "Invalid credentials" ||
            serverMessage === "Username and password are required"
            ? "שם משתמש או סיסמה שגויים"
            : serverMessage
        );
      } else if (status >= 500) {
        setError("שגיאת שרת זמנית. נסו שוב בעוד רגע.");
      } else {
        setError(serverMessage || "שם משתמש או סיסמה שגויים");
      }
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
              name="username"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onBlur={() => setUsername((prev) => normalizeLoginUsername(prev))}
              onPaste={(event) => {
                event.preventDefault();
                const text = event.clipboardData?.getData("text") || "";
                setUsername(normalizeLoginUsername(text));
              }}
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
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setPassword((prev) => normalizeLoginPassword(prev))}
              onPaste={(event) => {
                event.preventDefault();
                const text = event.clipboardData?.getData("text") || "";
                setPassword(normalizeLoginPassword(text));
              }}
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
