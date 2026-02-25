// src/components/AppLayout.tsx
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  Shield,
  GraduationCap,
  Menu,
  X,
  Building2,
  LogOut,
  Users as UsersIcon,
  Thermometer,
  Truck,
  Cross,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import AdminOverlayBar from "@/components/AdminOverlayBar";
import { useTenant } from "@/lib/tenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { listOpenCorrectiveActions } from "@/lib/temps";

type NavItem = {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/app" },
  { icon: ClipboardCheck, label: "Daily Checks", path: "/app/checks" },
  { icon: Thermometer, label: "Temps", path: "/app/temps" },
  { icon: Truck, label: "Suppliers", path: "/app/suppliers" },
  { icon: AlertTriangle, label: "Incidents", path: "/app/incidents" },
  { icon: Cross, label: "EHO Visits", path: "/app/eho" },
  { icon: Shield, label: "HACCP", path: "/app/haccp" },
  { icon: GraduationCap, label: "Training", path: "/app/training" },
  { icon: BarChart3, label: "Reports", path: "/app/reports" },
  { icon: Building2, label: "Locations", path: "/app/sites", adminOnly: true },
  { icon: UsersIcon, label: "Users", path: "/app/users", adminOnly: true },
];

function isOverdueDateOnly(dueDate?: string | null) {
  if (!dueDate) return false;
  const t = new Date(dueDate).getTime();
  if (Number.isNaN(t)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t < today.getTime();
}

function isOverdueDatetime(dueAt?: string | null) {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

type SidebarBadges = {
  tempOpen: number;
  tempOverdue: number;
  ehoOpen: number;
  ehoOverdue: number;
};

async function listOpenEhoActions(companyId: string, siteId: string, limit = 200) {
  const { data, error } = await supabase
    .from("eho_visit_actions")
    .select(
      `
      id,
      due_date,
      status,
      eho_visits!inner (
        company_id,
        site_id
      )
    `
    )
    .eq("status", "open")
    .eq("eho_visits.company_id", companyId)
    .eq("eho_visits.site_id", siteId)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as any[];
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  // IMPORTANT: we pull activeCompanyId + activeSiteId for scoped badges
  const { tenant, activeCompanyId, activeSiteId } = useTenant() as any;

  const [displayName, setDisplayName] = useState<string>("");

  const [badges, setBadges] = useState<SidebarBadges>({
    tempOpen: 0,
    tempOverdue: 0,
    ehoOpen: 0,
    ehoOverdue: 0,
  });

  const [badgesLoading, setBadgesLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setDisplayName("");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setDisplayName("");
        return;
      }

      setDisplayName((data as any)?.full_name ?? "");
    };

    run();
  }, [user?.id]);

  const userLabel = useMemo(
    () => displayName?.trim() || user?.email || "Workspace",
    [displayName, user?.email]
  );

  // keep as you had it (route guards still protect)
  const visibleNav = navItems.filter((x) => !x.adminOnly);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const loadBadges = async () => {
    if (!activeCompanyId || !activeSiteId) {
      setBadges({ tempOpen: 0, tempOverdue: 0, ehoOpen: 0, ehoOverdue: 0 });
      return;
    }

    try {
      setBadgesLoading(true);

      const [tempOpen, ehoOpen] = await Promise.all([
        listOpenCorrectiveActions(activeCompanyId, activeSiteId, 200),
        listOpenEhoActions(activeCompanyId, activeSiteId, 200),
      ]);

      const tempOverdue = (tempOpen ?? []).filter((a: any) =>
        isOverdueDatetime(a?.due_at)
      ).length;

      const ehoOverdue = (ehoOpen ?? []).filter((a: any) =>
        isOverdueDateOnly(a?.due_date)
      ).length;

      setBadges({
        tempOpen: tempOpen?.length ?? 0,
        tempOverdue,
        ehoOpen: ehoOpen?.length ?? 0,
        ehoOverdue,
      });
    } catch (e) {
      // silent fail (badges are non-critical)
      setBadges((prev) => prev);
    } finally {
      setBadgesLoading(false);
    }
  };

  // Refresh badges on:
  // - company/site change
  // - route change
  // - interval (30s)
  useEffect(() => {
    loadBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId, location.pathname]);

  useEffect(() => {
    const t = setInterval(() => {
      loadBadges();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  function renderBadgeForPath(path: string) {
    if (badgesLoading) return null;

    if (path === "/app/temps") {
      if (badges.tempOverdue > 0) return <Badge variant="destructive">{badges.tempOverdue}</Badge>;
      if (badges.tempOpen > 0) return <Badge variant="secondary">{badges.tempOpen}</Badge>;
      return null;
    }

    if (path === "/app/eho") {
      if (badges.ehoOverdue > 0) return <Badge variant="destructive">{badges.ehoOverdue}</Badge>;
      if (badges.ehoOpen > 0) return <Badge variant="secondary">{badges.ehoOpen}</Badge>;
      return null;
    }

    return null;
  }

  return (
    <div className="flex h-dvh bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        <AdminOverlayBar />

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground truncate">
              {tenant?.companyName ?? "Safyra"}
            </span>
          </div>

          <div className="w-10" />
        </header>

        <div className="flex flex-1 min-w-0 min-h-0">
          {/* Desktop Sidebar */}
          <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground tracking-tight truncate">
                  Safyra
                </h1>
                <p className="text-xs text-muted-foreground truncate">
                  {tenant?.companyName ?? "Compliance"}
                </p>
              </div>
            </div>

            <div className="px-3 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
                <Building2 className="w-4 h-4 text-accent-foreground" />
                <span className="text-sm font-medium text-accent-foreground truncate">
                  {userLabel}
                </span>
              </div>
            </div>

            <nav className="flex-1 px-3 py-2 space-y-1">
              {visibleNav.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex items-center justify-between gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <item.icon className="w-5 h-5" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {renderBadgeForPath(item.path)}
                  </button>
                );
              })}
            </nav>

            <div className="px-3 py-4 border-t border-border">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </aside>

          {/* Page content */}
          <main className="flex-1 min-h-0 overflow-y-auto">
            <Outlet />
          </main>
        </div>

        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col md:hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <h1 className="text-lg font-bold text-foreground truncate">
                      {tenant?.companyName ?? "Safyra"}
                    </h1>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
                    <Building2 className="w-4 h-4 text-accent-foreground" />
                    <span className="text-sm font-medium text-accent-foreground truncate">
                      {userLabel}
                    </span>
                  </div>
                </div>

                <nav className="flex-1 px-3 py-2 space-y-1">
                  {visibleNav.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setSidebarOpen(false);
                        }}
                        className={cn(
                          "flex items-center justify-between gap-3 w-full rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <item.icon className="w-5 h-5" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {renderBadgeForPath(item.path)}
                      </button>
                    );
                  })}
                </nav>

                <div className="px-3 py-4 border-t border-border">
                  <button
                    onClick={async () => {
                      await signOut();
                      setSidebarOpen(false);
                      navigate("/login");
                    }}
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around border-t border-border bg-card px-2 py-1 safe-area-bottom">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            const badge = renderBadgeForPath(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[56px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{item.label}</span>

                {/* Tiny badge on bottom nav */}
                {badge ? (
                  <span className="absolute top-1 right-2">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}