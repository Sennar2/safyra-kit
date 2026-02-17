import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // swap for a spinner later if you want

  if (!user) {
    sessionStorage.setItem("safyra_from", location.pathname);
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
