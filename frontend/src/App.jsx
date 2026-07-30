import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import EventPage from "./pages/EventPage.jsx";

const AdminProtectedRoute = lazy(() => import("./components/AdminProtectedRoute.jsx"));
const AgentProtectedRoute = lazy(() => import("./components/AgentProtectedRoute.jsx"));
const EventManagerProtectedRoute = lazy(() => import("./components/EventManagerProtectedRoute.jsx"));
const EventManagerEventLayout = lazy(() => import("./components/EventManagerEventLayout.jsx"));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage.jsx"));
const AgentClientsPage = lazy(() => import("./pages/AgentClientsPage.jsx"));
const AgentLoginPage = lazy(() => import("./pages/AgentLoginPage.jsx"));
const AgentWorkspacePage = lazy(() => import("./pages/AgentWorkspacePage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const EventManagerLoginPage = lazy(() => import("./pages/EventManagerLoginPage.jsx"));
const EventManagerPage = lazy(() => import("./pages/EventManagerPage.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const ClientLoginPage = lazy(() => import("./pages/ClientLoginPage.jsx"));
const ClientDashboardPage = lazy(() => import("./pages/ClientDashboardPage.jsx"));
const ClientAuditLogPage = lazy(() => import("./pages/ClientAuditLogPage.jsx"));
const ClientVendorsPage = lazy(() => import("./pages/ClientVendorsPage.jsx"));
const ManagerBudgetPage = lazy(() => import("./pages/ManagerBudgetPage.jsx"));
const IlSeatingPage = lazy(() => import("./pages/IlSeatingPage.jsx"));
const HostessPage = lazy(() => import("./pages/HostessPage.jsx"));
const EventManagerVendorsPage = lazy(() => import("./pages/EventManagerVendorsPage.jsx"));

function RouteFallback() {
  return (
    <div className="app-route-fallback" dir="rtl" lang="he">
      טוען…
    </div>
  );
}

function LazyRoute({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <LazyRoute>
            <LandingPage />
          </LazyRoute>
        }
      />
      <Route
        path="/admin/login"
        element={
          <LazyRoute>
            <AdminLoginPage />
          </LazyRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <LazyRoute>
            <AdminProtectedRoute>
              <AdminPage />
            </AdminProtectedRoute>
          </LazyRoute>
        }
      />
      <Route
        path="/manager/login"
        element={
          <LazyRoute>
            <EventManagerLoginPage />
          </LazyRoute>
        }
      />
      <Route
        path="/manager"
        element={
          <LazyRoute>
            <EventManagerProtectedRoute>
              <EventManagerPage />
            </EventManagerProtectedRoute>
          </LazyRoute>
        }
      />
      <Route
        path="/manager/vendors"
        element={
          <LazyRoute>
            <EventManagerProtectedRoute>
              <EventManagerVendorsPage />
            </EventManagerProtectedRoute>
          </LazyRoute>
        }
      />
      <Route
        path="/manager/events/:userId"
        element={
          <LazyRoute>
            <EventManagerProtectedRoute>
              <EventManagerEventLayout />
            </EventManagerProtectedRoute>
          </LazyRoute>
        }
      >
        <Route index element={<Navigate to="vendors" replace />} />
        <Route
          path="vendors"
          element={
            <LazyRoute>
              <ClientVendorsPage />
            </LazyRoute>
          }
        />
        <Route
          path="budget"
          element={
            <LazyRoute>
              <ManagerBudgetPage />
            </LazyRoute>
          }
        />
        <Route
          path="seating"
          element={
            <LazyRoute>
              <IlSeatingPage />
            </LazyRoute>
          }
        />
        <Route
          path="guests"
          element={
            <LazyRoute>
              <ClientDashboardPage />
            </LazyRoute>
          }
        />
        <Route
          path="audit-log"
          element={
            <LazyRoute>
              <ClientAuditLogPage />
            </LazyRoute>
          }
        />
      </Route>
      <Route
        path="/agent/login"
        element={
          <LazyRoute>
            <AgentLoginPage />
          </LazyRoute>
        }
      />
      <Route
        path="/agent"
        element={
          <LazyRoute>
            <AgentProtectedRoute>
              <AgentClientsPage />
            </AgentProtectedRoute>
          </LazyRoute>
        }
      />
      <Route
        path="/agent/workspace/:userId"
        element={
          <LazyRoute>
            <AgentProtectedRoute>
              <AgentWorkspacePage />
            </AgentProtectedRoute>
          </LazyRoute>
        }
      />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route
        path="/hostess/:eventId"
        element={
          <LazyRoute>
            <HostessPage />
          </LazyRoute>
        }
      />
      <Route path="/login" element={<Navigate to="/client/login" replace />} />
      <Route
        path="/client/login"
        element={
          <LazyRoute>
            <ClientLoginPage />
          </LazyRoute>
        }
      />
      <Route
        path="/client/dashboard/:userId"
        element={
          <LazyRoute>
            <ClientDashboardPage />
          </LazyRoute>
        }
      />
      <Route
        path="/client/dashboard/:userId/audit-log"
        element={
          <LazyRoute>
            <ClientAuditLogPage />
          </LazyRoute>
        }
      />
      <Route
        path="/client/dashboard/:userId/vendors"
        element={
          <LazyRoute>
            <ClientVendorsPage />
          </LazyRoute>
        }
      />
      <Route
        path="/client/dashboard/:userId/seating"
        element={
          <LazyRoute>
            <IlSeatingPage />
          </LazyRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
