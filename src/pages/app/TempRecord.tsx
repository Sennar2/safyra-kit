import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";
import {
  createTempRecord,
  listSites,
  listTempAssets,
  listTempFoodItems,
  listTempProbes,
  type TempAssetRow,
  type TempFoodItemRow,
  type TempProbeRow,
  type TempKind,
} from "@/lib/temps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function localSiteKey(companyId: string) {
  return `safyra_active_site_${companyId}`;
}

export default function TempRecord() {
  const navigate = useNavigate();
  const { activeCompanyId } = useTenant();

  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState("");

  const [assets, setAssets] = useState<TempAssetRow[]>([]);
  const [foods, setFoods] = useState<TempFoodItemRow[]>([]);
  const [probes, setProbes] = useState<TempProbeRow[]>([]);

  const [tab, setTab] = useState<TempKind>("fridge");
  const [assetId, setAssetId] = useState<string>("");
  const [foodItemId, setFoodItemId] = useState<string>("");
  const [probeId, setProbeId] = useState<string>("");
  const [valueC, setValueC] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;

    const saved = localStorage.getItem(localSiteKey(activeCompanyId));
    if (saved) setSiteId(saved);

    (async () => {
      const s = await listSites(activeCompanyId);
      setSites(s.map((x) => ({ id: x.id, name: x.name })));

      const defaultSite = saved && s.some((x) => x.id === saved) ? saved : (s[0]?.id ?? "");
      if (!siteId && defaultSite) setSiteId(defaultSite);

      const p = await listTempProbes(activeCompanyId);
      setProbes(p);

      const f = await listTempFoodItems(activeCompanyId);
      setFoods(f.filter((x) => x.active));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId || !siteId) return;
    localStorage.setItem(localSiteKey(activeCompanyId), siteId);

    (async () => {
      const a = await listTempAssets(activeCompanyId, siteId);
      setAssets(a.filter((x) => x.active));
    })();
  }, [activeCompanyId, siteId]);

  const filteredAssets = useMemo(() => {
    if (tab === "fridge") return assets.filter((a) => a.type === "fridge");
    if (tab === "freezer") return assets.filter((a) => a.type === "freezer");
    return [];
  }, [assets, tab]);

  const canSave =
    !!activeCompanyId &&
    !!siteId &&
    !!valueC &&
    !Number.isNaN(Number(valueC)) &&
    (tab === "food" ? !!foodItemId : tab === "delivery" ? true : !!assetId);

  const submit = async () => {
    if (!activeCompanyId || !siteId) return;

    setErr(null);
    setSaving(true);
    try {
      await createTempRecord({
        companyId: activeCompanyId,
        siteId,
        kind: tab,
        valueC: Number(valueC),
        assetId: tab === "fridge" || tab === "freezer" ? assetId : null,
        foodItemId: tab === "food" ? foodItemId : null,
        probeId: probeId || null,
        notes: notes || null,
      });
      setValueC("");
      setNotes("");
      navigate("/app/temps");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Record temperatures</h1>
          <p className="text-sm text-muted-foreground mt-1">Save a new temperature reading.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/app/temps")}>
          Back
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Entry</CardTitle>
          <CardDescription>Choose site + category, then enter a value.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Site</div>
              <Select value={siteId} onValueChange={setSiteId}>
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

            <div>
              <div className="text-xs text-muted-foreground mb-1">Probe (optional)</div>
              <Select value={probeId} onValueChange={setProbeId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a probe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No probe</SelectItem>
                  {probes.filter((p) => p.active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.serial ? ` • ${p.serial}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TempKind)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="fridge">Fridges</TabsTrigger>
              <TabsTrigger value="freezer">Freezers</TabsTrigger>
              <TabsTrigger value="food">Foods</TabsTrigger>
              <TabsTrigger value="delivery">Deliveries</TabsTrigger>
            </TabsList>

            <TabsContent value="fridge" className="space-y-3 pt-3">
              <div className="text-xs text-muted-foreground">Fridge</div>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select fridge" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="freezer" className="space-y-3 pt-3">
              <div className="text-xs text-muted-foreground">Freezer</div>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select freezer" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="food" className="space-y-3 pt-3">
              <div className="text-xs text-muted-foreground">Food item</div>
              <Select value={foodItemId} onValueChange={setFoodItemId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select food" />
                </SelectTrigger>
                <SelectContent>
                  {foods.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}{f.category ? ` • ${f.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="delivery" className="space-y-1 pt-3">
              <div className="text-xs text-muted-foreground">
                Delivery reading (supplier rules later)
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Temperature (°C)</div>
              <Input value={valueC} onChange={(e) => setValueC(e.target.value)} placeholder="e.g. 3.8" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Notes (optional)</div>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Door opened during service" />
            </div>
          </div>

          <Button onClick={submit} disabled={!canSave || saving} className="w-full">
            {saving ? "Saving…" : "Save record"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
