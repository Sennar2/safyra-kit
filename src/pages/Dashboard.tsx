// src/pages/app/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  listOpenIncidentActions,
  completeIncidentAction,
  type IncidentActionRow,
} from "@/lib/incidents";

import { useTenant } from "@/lib/tenantContext";
import {
  getDashboardChecklistSummary,
  type DashboardChecklistSummary,
  type SiteRow,
} from "@/lib/checks";
import {
  getTempTodaySummary,
  listTempAssets,
  listOpenCorrectiveActions,
  listRecentlyCompletedCorrectiveActions,
  completeCorrectiveAction,
  type CorrectiveActionRow,
  type TempAssetRow,
  type TempRecordRow,
  type TempTodaySummary,
} from "@/lib/temps";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Thermometer,
  Snowflake,
  Utensils,
  RefreshCw,
  ListTodo,
  History,
  Cross,
} from "lucide-react";

import type React from "react";

function localSiteKey(companyId: string) {
  return `safyra_active_site_${companyId}`;
}

function formatDue(dueAt?: string | null) {
  if (!dueAt) return "—";
  const d = new Date(dueAt);
  return Number.isNaN(d.getTime()) ? String(dueAt) : d.toLocaleString();
}

function isOverdue(dueAt?: string | null) {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

// EHO due_date is date-only; overdue if before today (00:00)
function isOverdueDateOnly(dueDate?: string | null) {
  if (!dueDate) return false;
  const t = new Date(dueDate).getTime();
  if (Number.isNaN(t)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t < today.getTime();
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function inRange(dt: string | null | undefined, a: Date, b: Date) {
  if (!dt) return false;
  const t = new Date(dt).getTime();
  return t >= a.getTime() && t < b.getTime();
}

function getWindows(now = new Date()) {
  const dayStart = startOfDay(now);

  const amStart = dayStart;
  const amEnd = new Date(dayStart);
  amEnd.setHours(14, 0, 0, 0);

  const pmStart = new Date(dayStart);
  pmStart.setHours(14, 0, 0, 0);

  // 02:00 next day
  const pmEnd = new Date(dayStart);
  pmEnd.setHours(2, 0, 0, 0);
  pmEnd.setTime(addDays(pmEnd, 1).getTime());

  return { amStart, amEnd, pmStart, pmEnd };
}

function priorityBadge(priority?: string | null) {
  const p = (priority ?? "medium").toLowerCase();
  if (p === "critical") return <Badge variant="destructive">critical</Badge>;
  if (p === "high")
    return (
      <Badge variant="outline" className="border-red-200 text-red-700">
        high
      </Badge>
    );
  if (p === "low") return <Badge variant="outline">low</Badge>;
  return <Badge variant="secondary">medium</Badge>;
}

function formatRole(role?: string | null) {
  if (!role) return "Unassigned";
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type EhoActionRow = {
  id: string;
  visit_id: string;
  action_text: string;
  due_date: string | null;
  status: string | null;
  assigned_role: string | null;
};

async function listOpenEhoActions(companyId: string, siteId: string, limit = 50) {
  const { data, error } = await supabase
    .from("eho_visit_actions")
    .select(
      `
      id,
      visit_id,
      action_text,
      due_date,
      status,
      assigned_role,
      eho_visits!inner (id, company_id, site_id)`
    )
    .eq("status", "open")
    .eq("eho_visits.company_id", companyId)
    .eq("eho_visits.site_id", siteId)
    .order("due_date", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((x: any) => ({
    id: x.id,
    visit_id: x.visit_id,
    action_text: x.action_text,
    due_date: x.due_date,
    status: x.status,
    assigned_role: x.assigned_role,
  })) as EhoActionRow[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeCompanyId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Checklist summary
  const [summary, setSummary] = useState<DashboardChecklistSummary | null>(null);

  // Temps summary
  const [tempSummary, setTempSummary] = useState<TempTodaySummary | null>(null);
  const [tempAssets, setTempAssets] = useState<TempAssetRow[]>([]);

  // Temp corrective actions
  const [actions, setActions] = useState<CorrectiveActionRow[]>([]);
  const [recentActions, setRecentActions] = useState<CorrectiveActionRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  // EHO actions
  const [ehoActions, setEhoActions] = useState<EhoActionRow[]>([]);

  // Completion notes UI
  const [completeOpenId, setCompleteOpenId] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState<Record<string, string>>(
    {}
  );
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Site selection
  const [activeSiteId, setActiveSiteId] = useState<string>("");

  const sites = summary?.sites ?? [];

  const activeSite: SiteRow | null = useMemo(() => {
    if (!sites.length) return null;
    return sites.find((s) => s.id === activeSiteId) ?? sites[0] ?? null;
  }, [sites, activeSiteId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const saved = localStorage.getItem(localSiteKey(activeCompanyId));
    if (saved) setActiveSiteId(saved);
  }, [activeCompanyId]);

  const load = async (companyId: string, siteIdGuess: string) => {
    setErr(null);
    setLoading(true);

    try {
      // 1) Checklist summary
      const s = await getDashboardChecklistSummary(companyId, siteIdGuess);
      setSummary(s);

      const resolvedSite =
        s.sites.find((x) => x.id === siteIdGuess) ?? s.sites[0] ?? null;

      if (!resolvedSite) {
        setTempSummary(null);
        setTempAssets([]);
        setActions([]);
        setRecentActions([]);
        setEhoActions([]);
        return;
      }

      if (resolvedSite.id !== siteIdGuess) {
        setActiveSiteId(resolvedSite.id);
        localStorage.setItem(localSiteKey(companyId), resolvedSite.id);
      }

      // 2) Temps + Actions + EHO Actions
      const [assets, today, openActions, completedActions, openEho] =
        await Promise.all([
          listTempAssets(companyId, resolvedSite.id),
          getTempTodaySummary(companyId, resolvedSite.id),
          listOpenCorrectiveActions(companyId, resolvedSite.id, 50),
          listRecentlyCompletedCorrectiveActions(companyId, resolvedSite.id, 8),
          listOpenEhoActions(companyId, resolvedSite.id, 50),
        ]);

      setTempAssets(assets);
      setTempSummary(today);
      setActions(openActions);
      setRecentActions(completedActions);
      setEhoActions(openEho);
    } catch (e: any) {
      console.error("Dashboard load error:", e);
      setErr(e?.message ?? "Failed to load dashboard");
      setSummary(null);
      setTempSummary(null);
      setTempAssets([]);
      setActions([]);
      setRecentActions([]);
      setEhoActions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;
    const siteGuess = activeSiteId || "00000000-0000-0000-0000-000000000000";
    load(activeCompanyId, siteGuess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  const hasSites = (sites?.length ?? 0) > 0;

  const tempsKpis = useMemo(() => {
    const { amStart, amEnd, pmStart, pmEnd } = getWindows(new Date());

    const activeColdAssets = (tempAssets ?? []).filter(
      (a) => a.active && (a.type === "fridge" || a.type === "freezer")
    );

    const assetCount = activeColdAssets.length;
    const targetAssetTemps = assetCount * 2; // AM + PM
    const targetFoodTemps = 8;

    const records = (tempSummary?.recordsToday ?? []) as TempRecordRow[];

    const assetRecords = records.filter(
      (r) => r.kind === "fridge" || r.kind === "freezer"
    );
    const foodRecords = records.filter((r) => r.kind === "food");

    const byAssetId = new Map<string, TempRecordRow[]>();
    for (const r of assetRecords) {
      if (!r.asset_id) continue;
      const arr = byAssetId.get(r.asset_id) ?? [];
      arr.push(r);
      byAssetId.set(r.asset_id, arr);
    }

    let amCovered = 0;
    let pmCovered = 0;

    for (const a of activeColdAssets) {
      const rs = byAssetId.get(a.id) ?? [];
      const hasAm = rs.some((r) => inRange(r.recorded_at, amStart, amEnd));
      const hasPm = rs.some((r) => inRange(r.recorded_at, pmStart, pmEnd));
      if (hasAm) amCovered += 1;
      if (hasPm) pmCovered += 1;
    }

    const amOk = assetCount === 0 ? true : amCovered >= assetCount;
    const pmOk = assetCount === 0 ? true : pmCovered >= assetCount;

    const assetsOk =
      assetRecords.length >= targetAssetTemps ||
      (assetCount === 0 && assetRecords.length === 0);
    const foodOk = foodRecords.length >= targetFoodTemps;

    return {
      assetCount,
      targetAssetTemps,
      targetFoodTemps,
      assetRecorded: assetRecords.length,
      foodRecorded: foodRecords.length,
      amCovered,
      pmCovered,
      amOk,
      pmOk,
      assetsOk,
      foodOk,
    };
  }, [tempAssets, tempSummary]);

  const tempOpenCount = actions.length;
  const ehoOpenCount = ehoActions.length;
  const ehoOverdueCount = ehoActions.filter((a) =>
    isOverdueDateOnly(a.due_date)
  ).length;

  const openActionsCount = tempOpenCount + ehoOpenCount;

  const refreshActions = async () => {
    if (!activeCompanyId || !activeSite?.id) return;
    const [open, completed, openEho] = await Promise.all([
      listOpenCorrectiveActions(activeCompanyId, activeSite.id, 50),
      listRecentlyCompletedCorrectiveActions(activeCompanyId, activeSite.id, 8),
      listOpenEhoActions(activeCompanyId, activeSite.id, 50),
    ]);
    setActions(open);
    setRecentActions(completed);
    setEhoActions(openEho);
  };

  const onCompleteAction = async (actionId: string) => {
    if (!activeCompanyId || !activeSite?.id) return;

    const notes = (completeNotes[actionId] ?? "").trim();
    if (!notes) {
      setErr("Please add completion notes (what was done) before completing.");
      setCompleteOpenId(actionId);
      return;
    }

    try {
      setActionsLoading(true);
      setCompletingId(actionId);
      setErr(null);

      await completeCorrectiveAction(actionId, notes);

      await refreshActions();

      setCompleteOpenId(null);
      setCompleteNotes((prev) => ({ ...prev, [actionId]: "" }));
    } catch (e: any) {
      console.error("completeCorrectiveAction error:", e);
      setErr(e?.message ?? "Failed to complete action");
    } finally {
      setActionsLoading(false);
      setCompletingId(null);
    }
  };

  // If no sites, show mandatory setup
  if (!loading && summary && !hasSites) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              You need at least one site before you can run checklists and temps.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/hub")}>
            Back to Hub
          </Button>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Set up your first site</CardTitle>
            <CardDescription>
              Sites are mandatory. Create a site (e.g. “Kings Road”) then build
              Opening/Closing checklists for it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="min-w-0">
                <div className="font-semibold">1) Create a site</div>
                <div className="text-sm text-muted-foreground">
                  Add your first location (address optional). You can add more
                  later.
                </div>
              </div>
              <Button onClick={() => navigate("/app/sites")} className="gap-2">
                <Plus className="w-4 h-4" />
                Create site
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 opacity-70">
              <div className="min-w-0">
                <div className="font-semibold">
                  2) Create checklist templates
                </div>
                <div className="text-sm text-muted-foreground">
                  Opening, Closing, Delivery, Cleaning…
                </div>
              </div>
              <Button variant="outline" disabled>
                Next
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 opacity-70">
              <div className="min-w-0">
                <div className="font-semibold">
                  3) Schedule recurring runs
                </div>
                <div className="text-sm text-muted-foreground">
                  “Opening by 2pm”, “Weekly deep clean”, etc.
                </div>
              </div>
              <Button variant="outline" disabled>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Today’s compliance overview for your selected site.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/hub")}>
            Control Hub
          </Button>
          <Button onClick={() => navigate("/app/checks")} className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Go to Checklists
          </Button>
          <Button
            onClick={() => navigate("/app/temps")}
            variant="outline"
            className="gap-2"
          >
            <Thermometer className="w-4 h-4" />
            Temps
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">Active site</div>
          <div className="min-w-[260px]">
            <Select
              value={activeSite?.id ?? ""}
              onValueChange={(val) => {
                if (!activeCompanyId) return;
                setActiveSiteId(val);
                localStorage.setItem(localSiteKey(activeCompanyId), val);
              }}
              disabled={!hasSites}
            >
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

          {(activeSite as any)?.status ? (
            <Badge
              variant={(activeSite as any).status === "active" ? "default" : "secondary"}
            >
              {(activeSite as any).status}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!activeCompanyId) return;
              const siteGuess =
                activeSite?.id ||
                activeSiteId ||
                "00000000-0000-0000-0000-000000000000";
              load(activeCompanyId, siteGuess);
            }}
            disabled={loading || !activeCompanyId}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>

          <Button
            onClick={() => navigate("/app/checks")}
            disabled={!activeSite?.id}
            className="gap-2"
          >
            Start a checklist <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Overdue"
          value={summary?.overdue?.length ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone="danger"
          loading={loading}
        />
        <StatCard
          title="Due today"
          value={summary?.dueToday?.length ?? 0}
          icon={<ClipboardCheck className="w-5 h-5" />}
          tone="warn"
          loading={loading}
        />
        <StatCard
          title="Completed today"
          value={summary?.completedToday?.length ?? 0}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="ok"
          loading={loading}
        />
        <StatCard
          title="Open actions"
          value={openActionsCount}
          icon={<ListTodo className="w-5 h-5" />}
          tone={openActionsCount > 0 ? "danger" : "ok"}
          loading={loading}
        />
      </div>

      {/* Temps corrective actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Corrective actions
          </CardTitle>
          <CardDescription>
            Generated when a temperature requires action. Add completion notes to close the action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : actions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No open actions ✅</div>
          ) : (
            <div className="space-y-2">
              {actions.slice(0, 12).map((a) => {
                const overdue = isOverdue(a.due_at);
                const open = completeOpenId === a.id;

                return (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-lg border p-3 flex items-start justify-between gap-3",
                      overdue ? "border-red-200" : "border-border"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold truncate">
                          {a.title ?? "Corrective action"}
                        </div>
                        {overdue ? (
                          <Badge variant="destructive">overdue</Badge>
                        ) : (
                          <Badge variant="secondary">open</Badge>
                        )}
                        {priorityBadge(a.priority)}
                      </div>

                      <div className="text-xs text-muted-foreground mt-1">
                        <span className={cn(overdue && "text-red-600 font-medium")}>
                          Due: {formatDue(a.due_at)}
                        </span>
                        {" • "}
                        Created:{" "}
                        {a.created_at
                          ? new Date(a.created_at).toLocaleString()
                          : "—"}
                      </div>

                      {a.details ? (
                        <div className="mt-2 text-sm">
                          <div className="text-xs text-muted-foreground">
                            What needs doing
                          </div>
                          <div className="mt-1 whitespace-pre-line">
                            {a.details}
                          </div>
                        </div>
                      ) : null}

                      {open ? (
                        <div className="mt-3 rounded-lg border border-border p-3 bg-muted/20">
                          <div className="text-xs text-muted-foreground">
                            Completion notes (what was done) *
                          </div>
                          <Input
                            className="mt-2"
                            value={completeNotes[a.id] ?? ""}
                            onChange={(e) =>
                              setCompleteNotes((prev) => ({
                                ...prev,
                                [a.id]: e.target.value,
                              }))
                            }
                            placeholder='e.g. "Moved stock to Fridge 2, called engineer, re-check booked 30 mins."'
                          />

                          <div className="mt-2 flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCompleteOpenId(null)}
                              disabled={actionsLoading}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => onCompleteAction(a.id)}
                              disabled={actionsLoading}
                              className="gap-2"
                            >
                              {completingId === a.id
                                ? "Completing…"
                                : "Save & Complete"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => setCompleteOpenId(a.id)}
                        disabled={actionsLoading}
                      >
                        Complete
                      </Button>
                    </div>
                  </div>
                );
              })}

              {actions.length > 12 ? (
                <div className="text-xs text-muted-foreground pt-2">
                  Showing 12 of {actions.length}.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EHO Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cross className="w-5 h-5" />
            EHO actions
            {ehoOpenCount > 0 ? (
              <Badge variant={ehoOverdueCount > 0 ? "destructive" : "secondary"}>
                {ehoOverdueCount > 0 ? `${ehoOverdueCount} overdue` : `${ehoOpenCount} open`}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Actions raised from EHO/inspection visits for this site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : ehoActions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No open EHO actions ✅
            </div>
          ) : (
            <div className="space-y-2">
              {ehoActions.slice(0, 12).map((a) => {
                const overdue = isOverdueDateOnly(a.due_date);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-lg border p-3 flex items-start justify-between gap-3",
                      overdue ? "border-red-200 bg-red-50" : "border-border"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold truncate">
                          {a.action_text}
                        </div>
                        {overdue ? (
                          <Badge variant="destructive">overdue</Badge>
                        ) : (
                          <Badge variant="secondary">open</Badge>
                        )}
                        <Badge variant="outline">{formatRole(a.assigned_role)}</Badge>
                      </div>

                      <div className="text-xs text-muted-foreground mt-1">
                        <span className={cn(overdue && "text-red-600 font-medium")}>
                          Due: {a.due_date ?? "—"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/app/eho")}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}

              {ehoActions.length > 12 ? (
                <div className="text-xs text-muted-foreground pt-2">
                  Showing 12 of {ehoActions.length}.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently completed corrective actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Recently completed actions
          </CardTitle>
          <CardDescription>
            Shows what was done when an action was completed (latest first).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : recentActions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No completed actions yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentActions.map((a) => (
                <div key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold truncate">{a.title}</div>
                    <Badge variant="secondary">
                      Completed{" "}
                      {a.action_logged_at ? formatDue(a.action_logged_at) : "—"}
                    </Badge>
                  </div>

                  {a.details ? (
                    <div className="mt-2 text-sm">
                      <div className="text-xs text-muted-foreground">
                        What needed doing
                      </div>
                      <div className="mt-1 whitespace-pre-line">{a.details}</div>
                    </div>
                  ) : null}

                  <div className="mt-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      What was done
                    </div>
                    <div className="mt-1 whitespace-pre-line">
                      {(a as any).action_completed_notes || "—"}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Original due: {formatDue(a.due_at)} • Logged:{" "}
                    {formatDue(a.action_logged_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Temps compliance */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5" />
            Temps compliance (today)
          </CardTitle>
          <CardDescription>
            Assets target = 2× fridge/freezer count (AM by 2pm + PM by 2am). Food target = 8/day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={tempsKpis.assetsOk ? "default" : "destructive"}
                  className="gap-2"
                >
                  <Snowflake className="w-4 h-4" />
                  Assets temps {tempsKpis.assetRecorded} /{" "}
                  {tempsKpis.targetAssetTemps}
                </Badge>

                <Badge
                  variant={tempsKpis.foodOk ? "secondary" : "destructive"}
                  className="gap-2"
                >
                  <Utensils className="w-4 h-4" />
                  Food temps {tempsKpis.foodRecorded} / {tempsKpis.targetFoodTemps}
                </Badge>

                <Badge variant="outline">
                  Active cold assets: {tempsKpis.assetCount}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">
                    AM window (00:00 → 14:00)
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="font-semibold">Coverage</div>
                    <Badge variant={tempsKpis.amOk ? "default" : "destructive"}>
                      {tempsKpis.amCovered} / {tempsKpis.assetCount}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Each fridge/freezer must have ≥1 reading by 2pm.
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">
                    PM window (14:00 → 02:00)
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="font-semibold">Coverage</div>
                    <Badge variant={tempsKpis.pmOk ? "default" : "destructive"}>
                      {tempsKpis.pmCovered} / {tempsKpis.assetCount}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Each fridge/freezer must have ≥1 reading before 2am.
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => navigate("/app/temps")}>
                  Open Temps
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Checklist panels */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Next due</CardTitle>
            <CardDescription>Overdue first, then upcoming due today.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-3">
                {(summary?.overdue ?? []).slice(0, 4).map((r) => (
                  <RunRow
                    key={r.id}
                    title={r.template_name ?? "Checklist"}
                    subtitle={`OVERDUE • was due ${formatDue(r.due_at)}`}
                    tone="danger"
                    onOpen={() => navigate("/app/checks")}
                  />
                ))}

                {(summary?.dueToday ?? []).slice(0, 6).map((r) => (
                  <RunRow
                    key={r.id}
                    title={r.template_name ?? "Checklist"}
                    subtitle={`Due ${formatDue(r.due_at)}`}
                    tone="warn"
                    onOpen={() => navigate("/app/checks")}
                  />
                ))}

                {(summary?.overdue?.length ?? 0) === 0 &&
                  (summary?.dueToday?.length ?? 0) === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Nothing due right now. You’re on track ✅
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently completed</CardTitle>
            <CardDescription>Latest completions today for this site.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (summary?.completedToday?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">No completions yet today.</div>
            ) : (
              <div className="space-y-3">
                {summary!.completedToday.slice(0, 8).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {r.template_name ?? "Checklist"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Completed{" "}
                        {r.completed_at
                          ? new Date(r.completed_at).toLocaleString()
                          : "—"}
                      </div>
                    </div>
                    <Badge variant="secondary">done</Badge>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Tip: schedules generate runs automatically — you can still start runs manually.
              </div>
              <Button variant="outline" onClick={() => navigate("/app/checks")}>
                Open Checklists
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "danger" | "warn" | "ok";
  loading?: boolean;
}) {
  const { title, value, icon, tone, loading } = props;

  const toneClass =
    tone === "danger"
      ? "border-red-200"
      : tone === "warn"
      ? "border-amber-200"
      : "border-emerald-200";

  return (
    <div className={cn("rounded-xl border bg-card p-4", toneClass)}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-2 text-3xl font-extrabold">{loading ? "—" : value}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {tone === "danger"
          ? "Needs action"
          : tone === "warn"
          ? "Due today"
          : "Good progress"}
      </div>
    </div>
  );
}

function RunRow(props: {
  title: string;
  subtitle: string;
  tone: "danger" | "warn";
  onOpen: () => void;
}) {
  const { title, subtitle, tone, onOpen } = props;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-lg border border-border p-3 transition hover:bg-muted/40",
        tone === "danger" && "border-red-200"
      )}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{title}</div>
          <div
            className={cn(
              "text-xs",
              tone === "danger" ? "text-red-600" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </div>
        </div>
        <Badge variant={tone === "danger" ? "destructive" : "secondary"}>
          {tone === "danger" ? "overdue" : "due"}
        </Badge>
      </div>
    </button>
  );
}