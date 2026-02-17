import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSuperAdmin } from "@/lib/useSuperAdmin";

export default function RequireSuperAdmin() {
  const { user } = useAuth();
  const { loading, isSuperAdmin } = useSuperAdmin();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/no-access" replace />;
  }

  return <Outlet />;
}
