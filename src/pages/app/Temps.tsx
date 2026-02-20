// src/pages/app/Temps.tsx
import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/lib/tenantContext";
import {
  applyTempDefaults,
  createTempAsset,
  createTempExpectation,
  createTempFoodItem,
  createTempProbe,
  createTempRecord,
  createDeliveryTempRecord,
  evaluateTemp,
  getTempTodaySummary,
  listSites,
  listTempAssets,
  listTempExpectations,
  listTempFoodItems,
  listTempProbes,
  setTempAssetActive,
  setTempExpectationActive,
  type DeliveryResult,
  type TempAssetRow,
  type TempAssetType,
  type TempExpectationKind,
  type TempExpectationRow,
  type TempFoodItemRow,
  type TempProbeRow,
  type TempRecordRow,
  type TempTodaySummary,
  type TempKind,
  type CorrectiveActionPriority,
} from "@/lib/temps";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  Thermometer,
  Plus,
  RefreshCw,
  ClipboardList,
  Settings2,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Truck,
} from "lucide-react";

function localSiteKey(companyId: string) {
  return `safyra_active_site_${companyId}`;
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function minutesLabel(n?: number | null) {
  if (n === null || n === undefined) return "—";
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Radix SelectItem cannot have value=""
const NO_PROBE = "none";

function severityBadge(sev: "ok" | "warn" | "critical") {
  if (sev === "ok") return <Badge variant="secondary">OK</Badge>;
  if (sev === "warn") return <Badge variant="outline" className="border-amber-300 text-amber-700">Warning</Badge>;
  return <Badge variant="destructive">Action</Badge>;
}

function toIsoFromDatetimeLocal(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function Temps() {
  const { activeCompanyId } = useTenant();

  const [tab, setTab] = useState<"record" | "setup" | "scheduled">("record");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [siteId, setSiteId] = useState<string>("");
  const [sites, setSitesState] = useState<{ id: string; name: string }[]>([]);

  const [assets, setAssets] = useState<TempAssetRow[]>([]);
  const [probes, setProbes] = useState<TempProbeRow[]>([]);
  const [foods, setFoods] = useState<TempFoodItemRow[]>([]);
  const [expectations, setExpectations] = useState<TempExpectationRow[]>([]);
  const [recordsToday, setRecordsToday] = useState<TempRecordRow[]>([]);
  const [summary, setSummary] = useState<TempTodaySummary | null>(null);

  // record form
  const [recordKind, setRecordKind] = useState<TempKind>("fridge");
  const [recordAssetId, setRecordAssetId] = useState<string>("");
  const [recordFoodId, setRecordFoodId] = useState<string>("");
  const [recordProbeId, setRecordProbeId] = useState<string>(NO_PROBE);
  const [recordValue, setRecordValue] = useState<string>("");
  const [recordNotes, setRecordNotes] = useState<string>("");

  // delivery fields (NO batch)
  const [deliveryItemName, setDeliveryItemName] = useState("");
  const [deliverySupplier, setDeliverySupplier] = useState("");
  const [deliveryResult, setDeliveryResult] = useState<DeliveryResult>("ok");

  // corrective action fields
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [correctivePriority, setCorrectivePriority] = useState<CorrectiveActionPriority>("medium"); // UI only for now
  const [actionDueLocal, setActionDueLocal] = useState(""); // datetime-local (REQUIRED if actionTriggered)

  // setup forms
  const [newAssetType, setNewAssetType] = useState<TempAssetType>("fridge");
  const [newAssetName, setNewAssetName] = useState("");
  const [newProbeName, setNewProbeName] = useState("");
  const [newProbeSerial, setNewProbeSerial] = useState("");
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState("");
  const [newFoodRecommendedMin, setNewFoodRecommendedMin] = useState<string>("120");
  const [newFoodRequired, setNewFoodRequired] = useState(false);

  // scheduled (expectations)
  const [expKind, setExpKind] = useState<TempExpectationKind>("asset");
  const [expEveryMin, setExpEveryMin] = useState<string>("120");
  const [expAssetId, setExpAssetId] = useState<string>("");
  const [expFoodId, setExpFoodId] = useState<string>("");

  const activeSite = useMemo(() => {
    if (!sites.length) return null;
    return sites.find((s) => s.id === siteId) ?? sites[0] ?? null;
  }, [sites, siteId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const saved = localStorage.getItem(localSiteKey(activeCompanyId));
    if (saved) setSiteId(saved);
  }, [activeCompanyId]);

  const clearDeliveryFields = () => {
    setDeliveryItemName("");
    setDeliverySupplier("");
    setDeliveryResult("ok");
  };

  const clearCorrectiveFields = () => {
    setCorrectiveAction("");
    setCorrectivePriority("medium");
    setActionDueLocal("");
  };

  const loadAll = async (companyId: string, maybeSiteId?: string) => {
    setErr(null);
    setLoading(true);
    try {
      const s = await listSites(companyId);
      const mappedSites = s.map((x) => ({ id: x.id, name: x.name }));
      setSitesState(mappedSites);

      const targetSiteId =
        (maybeSiteId && mappedSites.find((x) => x.id === maybeSiteId)?.id) || mappedSites[0]?.id || "";

      if (targetSiteId && targetSiteId !== siteId) {
        setSiteId(targetSiteId);
        localStorage.setItem(localSiteKey(companyId), targetSiteId);
      }

      if (!targetSiteId) {
        setAssets([]);
        setProbes([]);
        setFoods([]);
        setExpectations([]);
        setRecordsToday([]);
        setSummary(null);
        return;
      }

      const [a, p, f, e, sum] = await Promise.all([
        listTempAssets(companyId, targetSiteId),
        listTempProbes(companyId),
        listTempFoodItems(companyId),
        listTempExpectations(companyId, targetSiteId),
        getTempTodaySummary(companyId, targetSiteId),
      ]);

      setAssets(a);
      setProbes(p);
      setFoods(f);
      setExpectations(e);
      setRecordsToday(sum.recordsToday);
      setSummary(sum);

      const firstAssetForKind =
        recordKind === "fridge" || recordKind === "freezer"
          ? a.find((x) => x.type === recordKind)?.id ?? ""
          : a[0]?.id ?? "";

      const firstFood = f[0]?.id ?? "";
      const firstProbe = p[0]?.id ?? "";

      if ((recordKind === "fridge" || recordKind === "freezer") && (!recordAssetId || !a.some((x) => x.id === recordAssetId))) {
        if (firstAssetForKind) setRecordAssetId(firstAssetForKind);
      }
      if (recordKind === "food" && (!recordFoodId || !f.some((x) => x.id === recordFoodId))) {
        if (firstFood) setRecordFoodId(firstFood);
      }

      if (!recordProbeId || recordProbeId === NO_PROBE) {
        setRecordProbeId(firstProbe || NO_PROBE);
      } else if (recordProbeId !== NO_PROBE && !p.some((x) => x.id === recordProbeId)) {
        setRecordProbeId(firstProbe || NO_PROBE);
      }

      if (!expAssetId && a[0]?.id) setExpAssetId(a[0].id);
      if (!expFoodId && f[0]?.id) setExpFoodId(f[0].id);
    } catch (e: any) {
      console.error("Temps loadAll error:", e);
      setErr(e?.message ?? "Failed to load temps");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;
    loadAll(activeCompanyId, siteId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    if (!siteId) return;
    localStorage.setItem(localSiteKey(activeCompanyId), siteId);
    loadAll(activeCompanyId, siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const valueNumber = recordValue ? Number(recordValue) : NaN;

  const liveEval = useMemo(() => {
    if (Number.isNaN(valueNumber)) return null;

    if (recordKind === "fridge" || recordKind === "freezer") {
      return evaluateTemp({ kind: recordKind, valueC: valueNumber });
    }
    if (recordKind === "food") {
      return evaluateTemp({ kind: "food", valueC: valueNumber, foodScotland: false });
    }
    if (recordKind === "delivery") {
      return evaluateTemp({ kind: "delivery", valueC: valueNumber });
    }
    return null;
  }, [recordKind, valueNumber]);

  const actionTriggered =
    !!liveEval?.requiresAction || (recordKind === "delivery" && deliveryResult !== "ok");

  const canRecord =
    !!activeCompanyId &&
    !!activeSite?.id &&
    !!recordValue &&
    !Number.isNaN(Number(recordValue)) &&
    (recordKind !== "delivery" || !!deliveryItemName.trim()) &&
    (!actionTriggered || (!!correctiveAction.trim() && !!actionDueLocal)) &&
    !saving;

  const onCreateRecord = async () => {
    if (!activeCompanyId || !activeSite?.id) return;

    const valueC = Number(recordValue);
    if (Number.isNaN(valueC)) return;

    try {
      setErr(null);
      setSaving(true);

      const dueIso = toIsoFromDatetimeLocal(actionDueLocal);

      if (actionTriggered && !dueIso) {
        setErr("Please set a valid due date/time for the corrective action.");
        return;
      }

      if (recordKind === "delivery") {
        await createDeliveryTempRecord({
          companyId: activeCompanyId,
          siteId: activeSite.id,
          valueC,
          probeId: recordProbeId === NO_PROBE ? null : recordProbeId,
          itemName: deliveryItemName.trim(),
          supplier: deliverySupplier.trim() || null,
          deliveryResult,
          notes: recordNotes || null,

          // NEW: task fields
          requiresAction: actionTriggered,
          actionNotes: actionTriggered ? correctiveAction.trim() : null,
          actionDueAt: actionTriggered ? dueIso : null,
        });

        setRecordValue("");
        setRecordNotes("");
        clearDeliveryFields();
        clearCorrectiveFields();
        await loadAll(activeCompanyId, activeSite.id);
        return;
      }

      await createTempRecord({
        companyId: activeCompanyId,
        siteId: activeSite.id,
        kind: recordKind,
        valueC,
        assetId: (recordKind === "fridge" || recordKind === "freezer") ? (recordAssetId || null) : null,
        foodItemId: recordKind === "food" ? (recordFoodId || null) : null,
        probeId: recordProbeId === NO_PROBE ? null : recordProbeId,
        notes: recordNotes || null,

        // NEW: task fields
        requiresAction: actionTriggered,
        actionNotes: actionTriggered ? correctiveAction.trim() : null,
        actionDueAt: actionTriggered ? dueIso : null,
      });

      setRecordValue("");
      setRecordNotes("");
      clearCorrectiveFields();
      await loadAll(activeCompanyId, activeSite.id);
    } catch (e: any) {
      console.error("create record error:", e);
      setErr(e?.message ?? "Failed to record temperature");
    } finally {
      setSaving(false);
    }
  };

  const onApplyDefaults = async () => {
    if (!activeCompanyId || !activeSite?.id) return;
    try {
      setErr(null);
      await applyTempDefaults(activeCompanyId, activeSite.id);
      await loadAll(activeCompanyId, activeSite.id);
    } catch (e: any) {
      console.error("applyTempDefaults error:", e);
      setErr(e?.message ?? "Failed to apply defaults");
    }
  };

  const overdueCount = summary?.overdue?.length ?? 0;
  const dueSoonCount = summary?.dueSoon?.length ?? 0;
  const enabledExpectationsCount = (expectations ?? []).filter((e) => e.active).length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Thermometer className="w-7 h-7" />
            Temperature Checks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Record temps, manage fridges/freezers & probes, and enable scheduled checks (optional).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => activeCompanyId && loadAll(activeCompanyId, siteId || undefined)}
            disabled={loading || !activeCompanyId}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">Active site</div>
          <div className="min-w-[260px]">
            <Select value={activeSite?.id ?? ""} onValueChange={(val) => setSiteId(val)} disabled={loading || sites.length === 0}>
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

          {enabledExpectationsCount > 0 ? (
            <Badge variant={overdueCount > 0 ? "destructive" : "secondary"} className="gap-1">
              <Timer className="w-3.5 h-3.5" />
              Scheduled ON ({enabledExpectationsCount})
            </Badge>
          ) : (
            <Badge variant="secondary">Scheduled OFF</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue {overdueCount}
            </Badge>
          )}
          {dueSoonCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <ClipboardList className="w-3.5 h-3.5" />
              Due soon {dueSoonCount}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Recorded today {recordsToday.length}
          </Badge>
        </div>
      </div>

      {err && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {(!activeCompanyId || sites.length === 0) && !loading ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Set up a site first</CardTitle>
            <CardDescription>Temperature checks are per-site. Create at least one site, then come back here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
          <TabsList>
            <TabsTrigger value="record" className="gap-2">
              <Thermometer className="w-4 h-4" />
              Record
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <Timer className="w-4 h-4" />
              Scheduled
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Record a temperature</CardTitle>
                <CardDescription>
                  If a record triggers an action, it will create a dashboard task until completed.
                  (Requires task notes + due date/time.)
                </CardDescription>
              </CardHeader>

              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={recordKind}
                    onValueChange={(v) => {
                      setRecordKind(v as TempKind);
                      clearCorrectiveFields();
                      if (v !== "delivery") clearDeliveryFields();
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fridge">Fridge</SelectItem>
                      <SelectItem value="freezer">Freezer</SelectItem>
                      <SelectItem value="food">Food probe</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(recordKind === "fridge" || recordKind === "freezer") && (
                  <div className="space-y-2">
                    <Label>{recordKind === "fridge" ? "Fridge" : "Freezer"}</Label>
                    <Select value={recordAssetId} onValueChange={setRecordAssetId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets
                          .filter((a) => a.type === recordKind)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} {a.active ? "" : "(inactive)"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">Tip: assets can be added/disabled in Setup.</div>
                  </div>
                )}

                {recordKind === "food" && (
                  <div className="space-y-2">
                    <Label>Food item</Label>
                    <Select value={recordFoodId} onValueChange={setRecordFoodId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select food item" />
                      </SelectTrigger>
                      <SelectContent>
                        {foods.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                            {f.recommended_every_minutes ? ` (suggested ${minutesLabel(f.recommended_every_minutes)})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {recordKind === "delivery" && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Item probed
                    </Label>
                    <Input
                      value={deliveryItemName}
                      onChange={(e) => setDeliveryItemName(e.target.value)}
                      placeholder="e.g. Chicken thighs, Milk, Calamari"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <div className="space-y-2">
                        <Label>Supplier (optional)</Label>
                        <Input value={deliverySupplier} onChange={(e) => setDeliverySupplier(e.target.value)} placeholder="e.g. Bidfood" />
                      </div>
                      <div className="space-y-2">
                        <Label>Result</Label>
                        <Select value={deliveryResult} onValueChange={(v) => setDeliveryResult(v as DeliveryResult)}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ok">OK</SelectItem>
                            <SelectItem value="reject">Reject</SelectItem>
                            <SelectItem value="quarantine">Quarantine</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mt-2">
                      Reject/quarantine will always require a corrective action task.
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Probe (optional)</Label>
                  <Select value={recordProbeId} onValueChange={setRecordProbeId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select probe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROBE}>No probe</SelectItem>
                      {probes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.serial ? `(${p.serial})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-2">
                    <Label>Temperature (°C)</Label>
                    {liveEval ? severityBadge(liveEval.severity) : null}
                  </div>

                  <Input value={recordValue} onChange={(e) => setRecordValue(e.target.value)} placeholder="e.g. 3.5" inputMode="decimal" />

                  {liveEval ? (
                    <div
                      className={cn(
                        "text-xs",
                        liveEval.severity === "critical"
                          ? "text-red-600"
                          : liveEval.severity === "warn"
                          ? "text-amber-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {liveEval.message}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Fridges/Delivery: ≤5 OK, 5–8 warning, ≥8 action • Freezers: ≤-18 OK, -18 to -15 warning, &gt;-15 action • Food: ≥75°C
                    </div>
                  )}
                </div>

                {actionTriggered && (
                  <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                    <div className="font-semibold text-red-700">Corrective action task will be created</div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-2 space-y-2">
                        <Label>Task notes (what needs doing) *</Label>
                        <Input
                          value={correctiveAction}
                          onChange={(e) => setCorrectiveAction(e.target.value)}
                          placeholder="e.g. Move stock, call engineer, re-check in 30 mins..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Due by (date & time) *</Label>
                        <Input
                          type="datetime-local"
                          value={actionDueLocal}
                          onChange={(e) => setActionDueLocal(e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Separator className="my-2" />
                      </div>

                      <div className="space-y-2 md:col-span-1">
                        <Label>Priority</Label>
                        <Select value={correctivePriority} onValueChange={(v) => setCorrectivePriority(v as CorrectiveActionPriority)}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">
                          (Priority saved later once we add DB columns — UI ready.)
                        </div>
                      </div>

                      <div className="md:col-span-2 text-xs text-red-700">
                        This will show on the dashboard until completed, and will be included in inspection reports.
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes (optional)</Label>
                  <Input value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} placeholder="Any notes…" />
                </div>

                <div className="md:col-span-2 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    If “Action required” triggers, due date + notes are mandatory.
                  </div>
                  <Button onClick={onCreateRecord} disabled={!canRecord} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {saving ? "Saving…" : "Save record"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overdue / Due soon</CardTitle>
                  <CardDescription>Only shows if scheduled checks are enabled.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : enabledExpectationsCount === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Scheduled checks are OFF. Enable them in the “Scheduled” tab if you want due/overdue tracking.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(summary?.overdue ?? []).slice(0, 10).map((d) => (
                        <div key={d.key} className="rounded-lg border border-red-200 p-3">
                          <div className="font-semibold">{d.label}</div>
                          <div className="text-xs text-red-600">
                            {d.last_recorded_at ? `Last: ${fmt(d.last_recorded_at)}` : "No record yet"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Every {minutesLabel(d.every_minutes)}</div>
                        </div>
                      ))}

                      {(summary?.overdue?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No overdue items ✅</div>}

                      <Separator className="my-3" />

                      {(summary?.dueSoon ?? []).slice(0, 10).map((d) => (
                        <div key={d.key} className="rounded-lg border border-border p-3">
                          <div className="font-semibold">{d.label}</div>
                          <div className="text-xs text-muted-foreground">Due: {d.due_at ? fmt(d.due_at) : "—"}</div>
                          <div className="text-xs text-muted-foreground mt-1">Every {minutesLabel(d.every_minutes)}</div>
                        </div>
                      ))}

                      {(summary?.dueSoon?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">Nothing due soon.</div>}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Today’s records</CardTitle>
                  <CardDescription>Latest recordings for this site.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : recordsToday.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No records yet today.</div>
                  ) : (
                    <div className="space-y-2">
                      {recordsToday.slice(0, 20).map((r) => {
                        const ev = evaluateTemp({ kind: r.kind as TempKind, valueC: Number(r.value_c) });

                        const title =
                          r.kind === "food"
                            ? `FOOD • ${r.food?.name ?? "Food"}`
                            : r.kind === "fridge" || r.kind === "freezer"
                            ? `${r.kind.toUpperCase()} • ${r.asset?.name ?? "Asset"}`
                            : `DELIVERY • ${r.delivery_item ?? "Item"}`;

                        const deliveryMeta =
                          r.kind === "delivery"
                            ? `${r.supplier ? ` • ${r.supplier}` : ""}${r.delivery_result ? ` • ${String(r.delivery_result).toUpperCase()}` : ""}`
                            : "";

                        const isAction = !!r.requires_action;
                        const isDone = isAction && !!r.action_logged;

                        return (
                          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{title}</div>
                              <div className="text-xs text-muted-foreground">
                                {fmt(r.recorded_at)}
                                {r.probe?.name ? ` • Probe: ${r.probe.name}` : ""}
                                {deliveryMeta}
                              </div>

                              {isAction ? (
                                <div className={cn("text-xs mt-1", isDone ? "text-emerald-700" : "text-red-600")}>
                                  {isDone ? "Completed" : "Action required"}
                                  {r.action_notes ? ` • ${r.action_notes}` : ""}
                                  {r.action_due_at ? ` • Due: ${fmt(r.action_due_at)}` : ""}
                                  {isDone && r.action_logged_at ? ` • Done: ${fmt(r.action_logged_at)}` : ""}
                                </div>
                              ) : null}

                              {r.notes ? <div className="text-xs text-muted-foreground mt-1">{r.notes}</div> : null}
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {isAction ? (
                                <Badge variant={isDone ? "secondary" : "destructive"}>{isDone ? "Complete" : "Action"}</Badge>
                              ) : (
                                severityBadge(ev.severity)
                              )}
                              <Badge variant="outline">{Number(r.value_c).toFixed(1)}°C</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SETUP TAB (unchanged except kept) */}
          <TabsContent value="setup" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Setup</CardTitle>
                <CardDescription>
                  Assets (fridges/freezers), probes, and food items. Companies control what exists and what’s active.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 space-y-4">
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Assets</div>
                    <div className="text-xs text-muted-foreground">Per-site fridges/freezers.</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Select value={newAssetType} onValueChange={(v) => setNewAssetType(v as TempAssetType)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fridge">Fridge</SelectItem>
                          <SelectItem value="freezer">Freezer</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                        placeholder="e.g. Fridge 1"
                        className="md:col-span-2"
                      />

                      <Button
                        className="md:col-span-3 gap-2"
                        onClick={async () => {
                          if (!activeCompanyId || !activeSite?.id || !newAssetName.trim()) return;
                          try {
                            setErr(null);
                            await createTempAsset({
                              companyId: activeCompanyId,
                              siteId: activeSite.id,
                              type: newAssetType,
                              name: newAssetName.trim(),
                              sort_order: 0,
                            });
                            setNewAssetName("");
                            await loadAll(activeCompanyId, activeSite.id);
                          } catch (e: any) {
                            setErr(e?.message ?? "Failed to create asset");
                          }
                        }}
                        disabled={!activeCompanyId || !activeSite?.id || !newAssetName.trim()}
                      >
                        <Plus className="w-4 h-4" />
                        Add asset
                      </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {assets.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No assets yet.</div>
                      ) : (
                        assets.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">
                                {a.type.toUpperCase()} • {a.name}
                              </div>
                              <div className="text-xs text-muted-foreground">Created {fmt(a.created_at)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={a.active ? "secondary" : "outline"}>{a.active ? "active" : "inactive"}</Badge>
                              <Switch
                                checked={a.active}
                                onCheckedChange={async (val) => {
                                  try {
                                    setErr(null);
                                    await setTempAssetActive(a.id, !!val);
                                    if (activeCompanyId && activeSite?.id) await loadAll(activeCompanyId, activeSite.id);
                                  } catch (e: any) {
                                    setErr(e?.message ?? "Failed to update asset");
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Recommended Defaults</div>
                    <div className="text-xs text-muted-foreground">
                      Optional helper to prefill assets/food/scheduled checks.
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">Use this if you want a quick starting point.</div>
                      <Button
                        variant="outline"
                        onClick={onApplyDefaults}
                        disabled={!activeCompanyId || !activeSite?.id}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Apply defaults
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Probes</div>
                    <div className="text-xs text-muted-foreground">Company-level probes (optional on records).</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input value={newProbeName} onChange={(e) => setNewProbeName(e.target.value)} placeholder="Probe name" />
                      <Input value={newProbeSerial} onChange={(e) => setNewProbeSerial(e.target.value)} placeholder="Serial (optional)" />
                      <Button
                        className="gap-2"
                        onClick={async () => {
                          if (!activeCompanyId || !newProbeName.trim()) return;
                          try {
                            setErr(null);
                            await createTempProbe(activeCompanyId, {
                              name: newProbeName.trim(),
                              serial: newProbeSerial.trim() || null,
                            });
                            setNewProbeName("");
                            setNewProbeSerial("");
                            if (activeSite?.id) await loadAll(activeCompanyId, activeSite.id);
                          } catch (e: any) {
                            setErr(e?.message ?? "Failed to create probe");
                          }
                        }}
                        disabled={!activeCompanyId || !newProbeName.trim()}
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Food items to probe</div>
                    <div className="text-xs text-muted-foreground">Suggested frequency is a hint only.</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <Input
                        value={newFoodName}
                        onChange={(e) => setNewFoodName(e.target.value)}
                        placeholder="Food name"
                        className="md:col-span-2"
                      />
                      <Input value={newFoodCategory} onChange={(e) => setNewFoodCategory(e.target.value)} placeholder="Category (optional)" />
                      <Input
                        value={newFoodRecommendedMin}
                        onChange={(e) => setNewFoodRecommendedMin(e.target.value)}
                        placeholder="Recommended mins"
                        inputMode="numeric"
                      />

                      <div className="md:col-span-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={newFoodRequired} onCheckedChange={setNewFoodRequired} />
                          <div className="text-sm">
                            Mark as <span className="font-semibold">required</span>
                          </div>
                        </div>
                        <Button
                          className="gap-2"
                          onClick={async () => {
                            if (!activeCompanyId || !newFoodName.trim()) return;
                            try {
                              setErr(null);
                              const rec = Number(newFoodRecommendedMin);
                              await createTempFoodItem(activeCompanyId, {
                                name: newFoodName.trim(),
                                category: newFoodCategory.trim() || null,
                                recommended_every_minutes: Number.isNaN(rec) ? 120 : rec,
                                required: newFoodRequired,
                              });
                              setNewFoodName("");
                              setNewFoodCategory("");
                              setNewFoodRecommendedMin("120");
                              setNewFoodRequired(false);
                              if (activeSite?.id) await loadAll(activeCompanyId, activeSite.id);
                            } catch (e: any) {
                              setErr(e?.message ?? "Failed to create food item");
                            }
                          }}
                          disabled={!activeCompanyId || !newFoodName.trim()}
                        >
                          <Plus className="w-4 h-4" />
                          Add food item
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SCHEDULED TAB (unchanged) */}
          <TabsContent value="scheduled" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled checks (optional)</CardTitle>
                <CardDescription>These create “due/overdue” tracking.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="font-semibold">Create schedule</div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <Select value={expKind} onValueChange={(v) => setExpKind(v as TempExpectationKind)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset">Asset (fridge/freezer)</SelectItem>
                        <SelectItem value="food">Food item</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectContent>
                    </Select>

                    {expKind === "asset" && (
                      <Select value={expAssetId} onValueChange={setExpAssetId}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.type.toUpperCase()} • {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {expKind === "food" && (
                      <Select value={expFoodId} onValueChange={setExpFoodId}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select food item" />
                        </SelectTrigger>
                        <SelectContent>
                          {foods.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Input value={expEveryMin} onChange={(e) => setExpEveryMin(e.target.value)} placeholder="Every minutes" inputMode="numeric" />

                    <Button
                      className="gap-2 md:col-span-1"
                      onClick={async () => {
                        if (!activeCompanyId || !activeSite?.id) return;

                        const every = Number(expEveryMin);
                        if (Number.isNaN(every) || every <= 0) return;

                        if (expKind === "asset" && !expAssetId) return;
                        if (expKind === "food" && !expFoodId) return;

                        try {
                          setErr(null);
                          await createTempExpectation({
                            companyId: activeCompanyId,
                            siteId: activeSite.id,
                            kind: expKind,
                            assetId: expKind === "asset" ? expAssetId : null,
                            foodItemId: expKind === "food" ? expFoodId : null,
                            everyMinutes: every,
                          });
                          setExpEveryMin("120");
                          await loadAll(activeCompanyId, activeSite.id);
                        } catch (e: any) {
                          setErr(e?.message ?? "Failed to create schedule");
                        }
                      }}
                      disabled={
                        !activeCompanyId ||
                        !activeSite?.id ||
                        !expEveryMin ||
                        (expKind === "asset" && !expAssetId) ||
                        (expKind === "food" && !expFoodId)
                      }
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="font-semibold">Existing schedules</div>

                  <div className="mt-3 space-y-2">
                    {expectations.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No schedules yet.</div>
                    ) : (
                      expectations.map((e) => {
                        const label =
                          e.kind === "asset"
                            ? `${e.asset?.type?.toUpperCase() ?? "ASSET"} • ${e.asset?.name ?? "Asset"}`
                            : e.kind === "food"
                            ? `FOOD • ${e.food?.name ?? "Food item"}`
                            : "DELIVERY • Delivery";

                        return (
                          <div
                            key={e.id}
                            className={cn(
                              "rounded-lg border border-border p-3 flex items-center justify-between gap-3",
                              !e.active && "opacity-70"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{label}</div>
                              <div className="text-xs text-muted-foreground">
                                Every {minutesLabel(e.every_minutes)} • Created {fmt(e.created_at)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge variant={e.active ? "secondary" : "outline"}>{e.active ? "on" : "off"}</Badge>
                              <Switch
                                checked={e.active}
                                onCheckedChange={async (val) => {
                                  try {
                                    setErr(null);
                                    await setTempExpectationActive(e.id, !!val);
                                    if (activeCompanyId && activeSite?.id) await loadAll(activeCompanyId, activeSite.id);
                                  } catch (ex: any) {
                                    setErr(ex?.message ?? "Failed to update schedule");
                                  }
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
