import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCompanies, createCompany } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Building2, ArrowRight } from "lucide-react";

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const c = await listCompanies();
      setCompanies(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canCreate = useMemo(() => name.trim().length >= 2, [name]);

  const onCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      await createCompany({ name: name.trim() });
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage tenants. (Super admin only.)
          </p>
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* Create */}
        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border">
            <div className="font-bold">Create company</div>
            <div className="text-xs text-muted-foreground">Super admin only.</div>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-sm font-semibold">Company name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. La Mia Mamma LTD"
            />
            <Button
              className="w-full"
              onClick={onCreate}
              disabled={!canCreate || creating}
            >
              {creating ? "Creating..." : "Create company"}
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-bold">All companies</div>
              <div className="text-xs text-muted-foreground">Tenants in this platform.</div>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : companies.length === 0 ? (
              <div className="text-sm text-muted-foreground">No companies yet.</div>
            ) : (
              <div className="space-y-2">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/admin/companies/${c.id}`)}
                    className="w-full text-left rounded-xl border border-border p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div className="font-semibold truncate">{c.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{c.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground hidden md:block">
                          {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
                        </div>
                        <div className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Manage <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
