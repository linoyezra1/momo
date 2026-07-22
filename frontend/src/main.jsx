import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

function RtlAppShell({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "he");
    document.body.setAttribute("dir", "rtl");
    document.body.setAttribute("lang", "he");
  }, []);

  return (
    <div className="app-root" dir="rtl" lang="he">
      {children}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <RtlAppShell>
        <App />
      </RtlAppShell>
    </BrowserRouter>
  </React.StrictMode>
);
