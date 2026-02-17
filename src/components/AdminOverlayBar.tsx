import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuperAdmin } from "@/lib/useSuperAdmin";

type Props = {
  className?: string;
};

export default function AdminOverlayBar({ className }: Props) {
  const { loading, isSuperAdmin } = useSuperAdmin();
  const location = useLocation();
  const navigate = useNavigate();

  const inAdminArea = useMemo(() => {
    return location.pathname.startsWith("/admin") || location.pathname.startsWith("/hub");
  }, [location.pathname]);

  if (loading) return null;
  if (!isSuperAdmin) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60",
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">Super Admin</div>
            <div className="text-[11px] text-muted-foreground">
              You can manage companies, users, and access.
            </div>
          </div>
        </div>

        {!inAdminArea ? (
          <button
            onClick={() => navigate("/hub")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-95"
          >
            Open Hub <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/app")}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Go to App <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
