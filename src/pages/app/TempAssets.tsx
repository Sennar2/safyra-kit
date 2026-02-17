import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/lib/tenantContext";
import { applyTempDefaults } from "@/lib/temps";
import {
  listSites,
  listTempAssets,
  createTempAsset,
  setTempAssetActive,
  listTempProbes,
  createTempProbe,
  listTempFoodItems,
  createTempFoodItem,
  listTempExpectations,
  createTempExpectation,
  setTempExpectationActive,
  type TempAssetRow,
  type TempExpectationRow,
  type TempExpectationKind,
} from "@/lib/temps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function localSiteKey(companyId: string) {
  return `safyra_active_site_${companyId}`;
}

export default function TempAssets() {
  const { activeCompanyId } = useTenant();

  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState("");

  const [assets, setAssets] = useState<TempAssetRow[]>([]);
  const [expectations, setExpectations] = useState<TempExpectationRow[]>([]);

  const [probes, setProbes] = useState<any[]>([]);
  const [foods, setFoods] = useState<any[]>([]);

  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<"fridge" | "freezer">("fridge");

  const [probeName, setProbeName] = useState("");
  const [probeSerial, setProbeSerial] = useState("");

  const [foodName, setFoodName] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [foodEvery, setFoodEvery] = useState("120");

  const [expKind, setExpKind] = useState<TempExpectationKind>("food");
  const [expAssetId, setExpAssetId] = useState("");
  const [expFoodId, setExpFoodId] = useState("");
  const [expEvery, setExpEvery] = useState("120");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = async (companyId: string, sId: string) => {
    setErr(null);
    setLoading(true);
    try {
      const [a, p, f, e] = await Promise.all([
        listTempAssets(companyId, sId),
        listTempProbes(companyId),
        listTempFoodItems(companyId),
        listTempExpectations(companyId, sId),
      ]);
      setAssets(a);
      setProbes(p);
      setFoods(f);
      setExpectations(e);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load setup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;

    (async () => {
      const s = await listSites(activeCompanyId);
      setSites(s.map((x) => ({ id: x.id, name: x.name })));

      const saved = localStorage.getItem(localSiteKey(activeCompanyId));
      const defaultSite = saved && s.some((x) => x.id === saved) ? saved : (s[0]?.id ?? "");
      setSiteId(defaultSite);

      if (defaultSite) {
        localStorage.setItem(localSiteKey(activeCompanyId), defaultSite);
        await reload(activeCompanyId, defaultSite);
      }
    })();
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId || !siteId) return;
    localStorage.setItem(localSiteKey(activeCompanyId), siteId);
    reload(activeCompanyId, siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const siteAssets = useMemo(() => assets.filter((a) => a.site_id === siteId), [assets, siteId]);
  const fridges = siteAssets.filter((a) => a.type === "fridge");
  const freezers = siteAssets.filter((a) => a.type === "freezer");

  const saveAsset = async () => {
    if (!activeCompanyId || !siteId || !assetName.trim()) return;
    await createTempAsset({ companyId: activeCompanyId, siteId, type: assetType, name: assetName.trim() });
    setAssetName("");
    await reload(activeCompanyId, siteId);
  };

  const saveProbe = async () => {
    if (!activeCompanyId || !probeName.trim()) return;
    await createTempProbe(activeCompanyId, { name: probeName.trim(), serial: probeSerial.trim() || null });
    setProbeName("");
    setProbeSerial("");
    await reload(activeCompanyId, siteId);
  };

  const saveFood = async () => {
    if (!activeCompanyId || !foodName.trim()) return;
    const every = Number(foodEvery);
    await createTempFoodItem(activeCompanyId, {
      name: foodName.trim(),
      category: foodCategory.trim() || null,
      recommended_every_minutes: Number.isFinite(every) ? every : 120,
      required: false,
    });
    setFoodName("");
    setFoodCategory("");
    setFoodEvery("120");
    await reload(activeCompanyId, siteId);
  };

  const saveExpectation = async () => {
    if (!activeCompanyId || !siteId) return;
    const every = Number(expEvery);
    if (!Number.isFinite(every) || every <= 0) return;

    if (expKind === "asset" && !expAssetId) return;
    if (expKind === "food" && !expFoodId) return;

    await createTempExpectation({
      companyId: activeCompanyId,
      siteId,
      kind: expKind,
      assetId: expKind === "asset" ? expAssetId : null,
      foodItemId: expKind === "food" ? expFoodId : null,
      everyMinutes: every,
    });

    await reload(activeCompanyId, siteId);
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Temperature Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add fridges/freezers, probes, food items, then set “expectations” (how often checks are due).
          </p>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <div className="text-xs text-muted-foreground">Site</div>
        <div className="min-w-[260px]">
          <Select value={siteId} onValueChange={setSiteId} disabled={!sites.length}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select a site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
  variant="outline"
  onClick={async () => {
    if (!activeCompanyId || !siteId) return;
    setErr(null);
    try {
      await applyTempDefaults(activeCompanyId, siteId);
      await reload(activeCompanyId, siteId);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to apply defaults");
    }
  }}
  disabled={!activeCompanyId || !siteId}
>
  Apply recommended defaults
</Button>


      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle>Fridges & Freezers</CardTitle>
            <CardDescription>Add/remove temperature assets per site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Select value={assetType} onValueChange={(v) => setAssetType(v as any)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                </SelectContent>
              </Select>
              <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Fridge 1" />
              <Button onClick={saveAsset} disabled={loading || !assetName.trim()}>
                Add
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-semibold">Fridges</div>
              {fridges.length === 0 ? (
                <div className="text-sm text-muted-foreground">No fridges yet.</div>
              ) : (
                fridges.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.active ? "active" : "inactive"}</div>
                    </div>
                    <Button variant="outline" onClick={() => setTempAssetActive(a.id, !a.active).then(() => reload(activeCompanyId!, siteId))}>
                      {a.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Freezers</div>
              {freezers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No freezers yet.</div>
              ) : (
                freezers.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.active ? "active" : "inactive"}</div>
                    </div>
                    <Button variant="outline" onClick={() => setTempAssetActive(a.id, !a.active).then(() => reload(activeCompanyId!, siteId))}>
                      {a.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Probes + Foods */}
        <Card>
          <CardHeader>
            <CardTitle>Probes & Food items</CardTitle>
            <CardDescription>Company-level setup used across sites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="font-semibold">Add probe</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input value={probeName} onChange={(e) => setProbeName(e.target.value)} placeholder="Probe name" />
                <Input value={probeSerial} onChange={(e) => setProbeSerial(e.target.value)} placeholder="Serial (optional)" />
                <Button onClick={saveProbe} disabled={!probeName.trim()}>
                  Add
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {probes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No probes yet.</div>
                ) : (
                  probes.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.serial ?? "—"}</div>
                      </div>
                      <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "active" : "inactive"}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-semibold">Add food item</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. Lasagna (RTE)" />
                <Input value={foodCategory} onChange={(e) => setFoodCategory(e.target.value)} placeholder="Category (optional)" />
                <Input value={foodEvery} onChange={(e) => setFoodEvery(e.target.value)} placeholder="Every minutes" />
                <Button onClick={saveFood} disabled={!foodName.trim()}>
                  Add
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {foods.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No food items yet.</div>
                ) : (
                  foods.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.category ?? "—"} • recommended {f.recommended_every_minutes}m
                        </div>
                      </div>
                      <Badge variant={f.active ? "default" : "secondary"}>{f.active ? "active" : "inactive"}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expectations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expectations (what is due)</CardTitle>
            <CardDescription>
              This controls “Due / Overdue” in the Temperatures page. Example: each RTE item every 120 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Select value={expKind} onValueChange={(v) => setExpKind(v as any)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="asset">Fridge/Freezer</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>

                  {expKind === "asset" ? (
                    <Select value={expAssetId} onValueChange={setExpAssetId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {siteAssets.filter((a) => a.active).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.type.toUpperCase()} • {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : expKind === "food" ? (
                    <Select value={expFoodId} onValueChange={setExpFoodId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select food" />
                      </SelectTrigger>
                      <SelectContent>
                        {foods.filter((f: any) => f.active).map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 rounded-md border border-border bg-background px-3 flex items-center text-sm text-muted-foreground">
                      Delivery expectation
                    </div>
                  )}

                  <Input value={expEvery} onChange={(e) => setExpEvery(e.target.value)} placeholder="Every minutes" />

                  <Button onClick={saveExpectation}>
                    Add
                  </Button>
                </div>

                <Separator />

                {expectations.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No expectations yet.</div>
                ) : (
                  <div className="space-y-2">
                    {expectations.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {e.kind === "asset"
                              ? `${e.asset?.type?.toUpperCase()} • ${e.asset?.name}`
                              : e.kind === "food"
                              ? `FOOD • ${e.food?.name}`
                              : "DELIVERY • Delivery temp"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Every {e.every_minutes} minutes
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => setTempExpectationActive(e.id, !e.active).then(() => reload(activeCompanyId!, siteId))}
                        >
                          {e.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
