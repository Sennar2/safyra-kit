import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("platform_users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("useSuperAdmin:", error);
        setIsSuperAdmin(false);
      } else {
        setIsSuperAdmin(data?.role === "super_admin");
      }

      setLoading(false);
    };

    if (!authLoading) run();
  }, [authLoading, user?.id]);

  return { loading: authLoading || loading, isSuperAdmin };
}
