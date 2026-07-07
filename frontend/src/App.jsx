import { Navigate, Route, Routes } from "react-router-dom";
import AdminProtectedRoute from "./components/AdminProtectedRoute.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import EventPage from "./pages/EventPage.jsx";
import ClientLoginPage from "./pages/ClientLoginPage.jsx";
import ClientDashboardPage from "./pages/ClientDashboardPage.jsx";
import IlSeatingPage from "./pages/IlSeatingPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminPage />
          </AdminProtectedRoute>
        }
      />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route path="/client/dashboard/:userId" element={<ClientDashboardPage />} />
      <Route path="/client/dashboard/:userId/seating" element={<IlSeatingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
