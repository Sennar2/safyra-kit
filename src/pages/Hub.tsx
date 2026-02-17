import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";
import { useAuth } from "@/lib/auth";
import { listCompanies, listMyCompanies } from "@/lib/platform";
import { useSuperAdmin } from "@/lib/useSuperAdmin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CompanyRow = {
  id: string;
  name: string;
  status: "active" | "inactive" | string;
  created_at: string;
};

export default function Hub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading: saLoading, isSuperAdmin } = useSuperAdmin();

  // ✅ NEW tenant API (from the updated tenantContext.tsx)
  const { activeCompanyId, activeCompanyName, setActiveCompany, clearActiveCompany } = useTenant();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = isSuperAdmin ? await listCompanies() : await listMyCompanies();
      setCompanies(data as CompanyRow[]);
    } catch (e: any) {
      console.error("Hub load error:", e);
      setErr(e?.message ?? "Failed to load companies");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (saLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, saLoading, isSuperAdmin]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Safyra Control Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a company to enter the tenant app. Super admin can manage everything.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate("/admin")}>
          Open Admin Dashboard →
        </Button>
      </div>

      {/* Active company card */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Active company</div>
          <div className="text-lg font-bold truncate">
            {/* ✅ show stored name first, then fallback to loaded list, then none */}
            {activeCompanyName ?? activeCompany?.name ?? "— none selected —"}
          </div>
          {activeCompanyId && (
            <div className="text-[11px] text-muted-foreground truncate">{activeCompanyId}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={clearActiveCompany}
            disabled={!activeCompanyId}
            className="min-w-[110px]"
          >
            Clear
          </Button>

          <Button
            onClick={() => navigate("/app")}
            disabled={!activeCompanyId}
            className="min-w-[140px]"
          >
            Enter app →
          </Button>
        </div>
      </div>

      {/* Companies list */}
      <div className="mt-6 rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold">Companies</h2>
            <p className="text-xs text-muted-foreground">
              Select one to set your active tenant context.
            </p>
          </div>

          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="p-4">
          {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : companies.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No companies available yet. Create one in the Admin Dashboard.
            </div>
          ) : (
            <div className="space-y-3">
              {companies.map((c) => {
                const selected = c.id === activeCompanyId;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition",
                      selected ? "bg-muted/60" : "bg-background"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.status} • {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>

                    <Button
                      variant={selected ? "default" : "outline"}
                      onClick={() => setActiveCompany({ id: c.id, name: c.name })}
                    >
                      {selected ? "Selected" : "Select"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            Tip: Set a company as active, then click Enter app. Super admin keeps admin powers even inside the tenant app.
          </div>
        </div>
      </div>
    </div>
  );
}
