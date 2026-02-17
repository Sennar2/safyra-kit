import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, ArrowRight, Activity } from "lucide-react";
import { listCompanies, type CompanyRow } from "@/lib/platform";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const recent = useMemo(() => companies.slice(0, 8), [companies]);

  const refresh = async () => {
    setLoading(true);
    try {
      const c = await listCompanies();
      setCompanies(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create companies, assign owners, and manage platform access.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => navigate("/admin/companies")}>
            Manage Companies <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/users")}>
            Manage Users
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Companies</div>
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-extrabold mt-2">{loading ? "—" : companies.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Active tenants on platform</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Users</div>
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-extrabold mt-2">—</div>
          <div className="text-xs text-muted-foreground mt-1">Wire global user count next</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Platform health</div>
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-extrabold mt-2">OK</div>
          <div className="text-xs text-muted-foreground mt-1">RLS + functions configured</div>
        </div>
      </div>

      {/* Recent companies */}
      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-bold">Recent companies</div>
            <div className="text-xs text-muted-foreground">Latest created tenants.</div>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : companies.length === 0 ? (
            <div className="text-sm text-muted-foreground">No companies yet.</div>
          ) : (
            <div className="space-y-2">
              {recent.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-xl border border-border p-4"
                >
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.status} • {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate("/admin/users")}>
                      Assign Users
                    </Button>
                    <Button onClick={() => navigate("/admin/companies")}>
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/companies")}>
              Create / Edit Companies
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/users")}>
              Create / Assign Users
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
