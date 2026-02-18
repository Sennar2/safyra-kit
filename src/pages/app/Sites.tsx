import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/tenantContext";
import { supabase } from "@/integrations/supabase/client";

export default function Sites() {
  const { activeCompanyId, sites, setActiveSiteId, refreshSites } = useTenant();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canCreate = useMemo(
    () => !!activeCompanyId && name.trim().length > 0 && !loading,
    [activeCompanyId, name, loading]
  );

  const createSite = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("sites")
        .insert([{ company_id: activeCompanyId, name: name.trim() }])
        .select("id,name")
        .single();

      if (error) throw error;

      setName("");
      await refreshSites();
      if (data?.id) setActiveSiteId(data.id);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Locations</h1>
        <p className="text-sm text-muted-foreground">Create and manage locations for this company.</p>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="font-semibold">Create location</div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chelsea, Kings Road"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) createSite();
          }}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <Button onClick={createSite} disabled={!canCreate}>
          {loading ? "Creating..." : "Create location"}
        </Button>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="font-semibold">Your locations</div>
        <div className="text-sm text-muted-foreground">
          Select a location from the sidebar dropdown to focus checks.
        </div>

        {sites.length === 0 ? (
          <div className="text-sm text-muted-foreground">No locations yet.</div>
        ) : (
          <div className="space-y-2">
            {sites.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.id}</div>
                </div>
                <Button variant="outline" onClick={() => setActiveSiteId(s.id)}>
                  Set active
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
