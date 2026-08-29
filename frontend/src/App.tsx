import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import AppLayout from "./components/layout/AppLayout";
import ManageAsins from "./pages/ManageAsins";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Sales from "./pages/Sales";
import OperationalAnalytics from "./pages/OperationalAnalytics";
import Alerts from "./pages/Alerts";
import Users from "./pages/Users";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/asins" element={<ManageAsins />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/users" element={<Users />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/operational-analytics" element={<OperationalAnalytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
