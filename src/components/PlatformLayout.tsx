import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenantContext";
import { useSuperAdmin } from "@/lib/useSuperAdmin";

type NavItem = {
  label: string;
  path: string;
};

export default function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { activeCompanyId } = useTenant();
  const { loading, isSuperAdmin } = useSuperAdmin();

  const nav: NavItem[] = [
    { label: "Control Hub", path: "/hub" },
    { label: "Admin Dashboard", path: "/admin" },
    { label: "Manage Companies", path: "/admin/companies" },
    { label: "Platform Users", path: "/admin/users" },
  ];

  const onSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      <aside className="hidden md:flex w-72 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Safyra</h1>
            <p className="text-xs text-muted-foreground">Platform</p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Signed in</div>
            <div className="text-sm font-semibold truncate">{user?.email ?? "—"}</div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Active company</div>
            <div className="text-sm font-semibold truncate">{activeCompanyId ? activeCompanyId : "— none selected —"}</div>
            <button
              disabled={!activeCompanyId}
              onClick={() => navigate("/app")}
              className={cn(
                "mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
                activeCompanyId
                  ? "bg-primary text-primary-foreground hover:opacity-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Enter app →
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={onSignOut}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>

        <div className="px-3 pb-4">
          <div className="text-[11px] text-muted-foreground">
            {loading ? "Checking permissions…" : isSuperAdmin ? "Super admin access" : "Standard access"}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
