import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function ClientLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await api.post("/client/login", { username, password });
      navigate(`/client/dashboard/${response.data.userId}`, { state: response.data });
    } catch {
      setError("שם משתמש או סיסמה שגויים");
    }
  };

  return (
    <div className="container">
      <form className="card form-grid" onSubmit={onSubmit}>
        <h1>כניסת לקוח</h1>
        <input placeholder="שם משתמש" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <input
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button type="submit">כניסה</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
