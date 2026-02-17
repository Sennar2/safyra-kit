import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("AuthCallback getSession error:", error);
        navigate("/login", { replace: true });
        return;
      }

      if (!data.session) {
        navigate("/login", { replace: true });
        return;
      }

      const from = sessionStorage.getItem("safyra_from") || "/";
      sessionStorage.removeItem("safyra_from");

      navigate(from, { replace: true });
    };

    run();
  }, [navigate]);

  return null;
}
