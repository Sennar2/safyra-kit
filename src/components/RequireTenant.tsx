import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenantContext";
import { useSuperAdmin } from "@/lib/useSuperAdmin";

export default function RequireTenant() {
  const { user, loading: authLoading } = useAuth();
  const { activeCompanyId } = useTenant();
  const { loading: saLoading, isSuperAdmin } = useSuperAdmin();
  const location = useLocation();

  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      // not logged in
      if (!user) {
        setAllowed(false);
        return;
      }

      // must have selected company first (super admin included)
      if (!activeCompanyId) {
        setAllowed(false);
        return;
      }

      // ✅ SUPER ADMIN BYPASS: can enter any company
      if (isSuperAdmin) {
        setAllowed(true);
        return;
      }

      // normal users: must be in company_users for that company
      const { data, error } = await supabase
        .from("company_users")
        .select("id")
        .eq("company_id", activeCompanyId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("RequireTenant membership error:", error);
        setAllowed(false);
        return;
      }

      setAllowed(!!data);
    };

    if (!authLoading && !saLoading) run();
  }, [authLoading, saLoading, user?.id, activeCompanyId, isSuperAdmin]);

  if (authLoading || saLoading || allowed === null) return null;

  if (!user) return <Navigate to="/login" replace />;

  // If no company selected or no membership, send to hub (not /no-access)
  if (!allowed) {
    return <Navigate to="/hub" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
