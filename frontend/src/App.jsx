import { Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage.jsx";
import ClientLoginPage from "./pages/ClientLoginPage.jsx";
import ClientDashboardPage from "./pages/ClientDashboardPage.jsx";
import SetupPage from "./pages/SetupPage.jsx";
import UsEventPage from "./pages/UsEventPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/e/:slug" element={<UsEventPage />} />
      <Route path="/event/:eventId" element={<UsEventPage />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route path="/client/dashboard/:userId" element={<ClientDashboardPage />} />
    </Routes>
  );
}
