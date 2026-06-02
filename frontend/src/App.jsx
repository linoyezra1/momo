import { Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage.jsx";
import EventPage from "./pages/EventPage.jsx";
import ClientLoginPage from "./pages/ClientLoginPage.jsx";
import ClientDashboardPage from "./pages/ClientDashboardPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminPage />} />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route path="/client/dashboard/:userId" element={<ClientDashboardPage />} />
    </Routes>
  );
}
