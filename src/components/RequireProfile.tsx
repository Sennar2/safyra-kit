import { Navigate, Outlet } from "react-router-dom";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/lib/auth";

export default function RequireProfile() {
  const { user } = useAuth();
  const { loading, profile } = useProfile();

  // Auth is already protected above this, but just in case:
  if (!user) return <Navigate to="/login" replace />;

  if (loading) return null;

  // If profile doesn't exist or no company yet -> onboarding
  if (!profile || !profile.company_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
