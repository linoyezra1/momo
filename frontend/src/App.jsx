import { Navigate, Route, Routes } from "react-router-dom";
import AdminProtectedRoute from "./components/AdminProtectedRoute.jsx";
import AgentProtectedRoute from "./components/AgentProtectedRoute.jsx";
import EventManagerProtectedRoute from "./components/EventManagerProtectedRoute.jsx";
import EventManagerEventLayout from "./components/EventManagerEventLayout.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AgentClientsPage from "./pages/AgentClientsPage.jsx";
import AgentLoginPage from "./pages/AgentLoginPage.jsx";
import AgentWorkspacePage from "./pages/AgentWorkspacePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import EventManagerLoginPage from "./pages/EventManagerLoginPage.jsx";
import EventManagerPage from "./pages/EventManagerPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import EventPage from "./pages/EventPage.jsx";
import ClientLoginPage from "./pages/ClientLoginPage.jsx";
import ClientDashboardPage from "./pages/ClientDashboardPage.jsx";
import ClientAuditLogPage from "./pages/ClientAuditLogPage.jsx";
import ClientVendorsPage from "./pages/ClientVendorsPage.jsx";
import ManagerBudgetPage from "./pages/ManagerBudgetPage.jsx";
import IlSeatingPage from "./pages/IlSeatingPage.jsx";
import HostessPage from "./pages/HostessPage.jsx";
import EventManagerVendorsPage from "./pages/EventManagerVendorsPage.jsx";

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
      <Route path="/manager/login" element={<EventManagerLoginPage />} />
      <Route
        path="/manager"
        element={
          <EventManagerProtectedRoute>
            <EventManagerPage />
          </EventManagerProtectedRoute>
        }
      />
      <Route
        path="/manager/vendors"
        element={
          <EventManagerProtectedRoute>
            <EventManagerVendorsPage />
          </EventManagerProtectedRoute>
        }
      />
      <Route
        path="/manager/events/:userId"
        element={
          <EventManagerProtectedRoute>
            <EventManagerEventLayout />
          </EventManagerProtectedRoute>
        }
      >
        <Route index element={<Navigate to="vendors" replace />} />
        <Route path="vendors" element={<ClientVendorsPage />} />
        <Route path="budget" element={<ManagerBudgetPage />} />
        <Route path="seating" element={<IlSeatingPage />} />
        <Route path="guests" element={<ClientDashboardPage />} />
        <Route path="audit-log" element={<ClientAuditLogPage />} />
      </Route>
      <Route path="/agent/login" element={<AgentLoginPage />} />
      <Route
        path="/agent"
        element={
          <AgentProtectedRoute>
            <AgentClientsPage />
          </AgentProtectedRoute>
        }
      />
      <Route
        path="/agent/workspace/:userId"
        element={
          <AgentProtectedRoute>
            <AgentWorkspacePage />
          </AgentProtectedRoute>
        }
      />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route path="/hostess/:eventId" element={<HostessPage />} />
      <Route path="/login" element={<Navigate to="/client/login" replace />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route path="/client/dashboard/:userId" element={<ClientDashboardPage />} />
      <Route path="/client/dashboard/:userId/audit-log" element={<ClientAuditLogPage />} />
      <Route path="/client/dashboard/:userId/vendors" element={<ClientVendorsPage />} />
      <Route path="/client/dashboard/:userId/seating" element={<IlSeatingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
