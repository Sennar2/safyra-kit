import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/tenantContext";
import { supabase } from "@/integrations/supabase/client";

export default function Sites() {
  const { activeCompanyId, sites = [], setActiveSiteId } = useTenant() as any;

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canCreate = useMemo(() => !!activeCompanyId && name.trim().length > 0 && !loading, [
    activeCompanyId,
    name,
    loading,
  ]);

  const createSite = async () => {
    if (!activeCompanyId) return;

    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("sites")
        .insert([{ company_id: activeCompanyId, name: name.trim() }])
        .select("*")
        .single();

      if (error) throw error;

      setName("");
      if (data?.id) setActiveSiteId?.(data.id);
      // TenantProvider should refresh sites after insert; if not, we can wire a reload method.
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Locations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create and manage locations for this company.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold">Create location</h2>
          <p className="text-sm text-muted-foreground">Company admin only.</p>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Location name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chelsea, Kings Road"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) createSite();
              }}
            />
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <Button onClick={createSite} disabled={!canCreate}>
            {loading ? "Creating..." : "Create location"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold">Your locations</h2>
          <p className="text-xs text-muted-foreground">
            Select a location from the sidebar dropdown to focus checks.
          </p>
        </div>

        <div className="p-5">
          {sites.length === 0 ? (
            <div className="text-sm text-muted-foreground">No locations yet.</div>
          ) : (
            <div className="space-y-2">
              {sites.map((s: any) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.id}</div>
                  </div>
                  <Button variant="outline" onClick={() => setActiveSiteId?.(s.id)}>
                    Set active
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
