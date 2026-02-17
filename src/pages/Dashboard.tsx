import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";
import { getDashboardChecklistSummary, type DashboardChecklistSummary, type SiteRow } from "@/lib/checks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ClipboardCheck, AlertTriangle, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import type React from "react";

function localSiteKey(companyId: string) {
  return `safyra_active_site_${companyId}`;
}

function formatDue(dueAt?: string | null) {
  if (!dueAt) return "—";
  const d = new Date(dueAt);
  return d.toLocaleString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeCompanyId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [summary, setSummary] = useState<DashboardChecklistSummary | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string>("");

  const sites = summary?.sites ?? [];

  const activeSite: SiteRow | null = useMemo(() => {
    if (!sites.length) return null;
    return sites.find((s) => s.id === activeSiteId) ?? sites[0];
  }, [sites, activeSiteId]);

  // Bootstrap siteId from localStorage once company is known
  useEffect(() => {
    if (!activeCompanyId) return;
    const saved = localStorage.getItem(localSiteKey(activeCompanyId));
    if (saved) setActiveSiteId(saved);
  }, [activeCompanyId]);

  const load = async (companyId: string, siteId: string) => {
    setErr(null);
    setLoading(true);
    try {
      const s = await getDashboardChecklistSummary(companyId, siteId);
      setSummary(s);

      // If current siteId invalid, fallback to first site
      const validSite = s.sites.find((x) => x.id === siteId) ?? s.sites[0] ?? null;
      if (validSite && validSite.id !== siteId) {
        setActiveSiteId(validSite.id);
        localStorage.setItem(localSiteKey(companyId), validSite.id);
      }
    } catch (e: any) {
      console.error("Dashboard load error:", e);
      setErr(e?.message ?? "Failed to load dashboard");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  // Load dashboard once we have company + a site guess
  useEffect(() => {
    if (!activeCompanyId) return;

    // We don't know sites until we load; but the query needs a siteId.
    // Strategy:
    // 1) try saved siteId
    // 2) if empty, do a lightweight first load using the saved or placeholder, then auto-correct
    const siteId = activeSiteId || "00000000-0000-0000-0000-000000000000";

    load(activeCompanyId, siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  const hasSites = sites.length > 0;

  // If no sites, show mandatory setup
  if (!loading && summary && !hasSites) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You need at least one site before you can run checklists.
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
              Sites are mandatory. Create a site (e.g. “Kings Road”) then build Opening/Closing checklists for it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="min-w-0">
                <div className="font-semibold">1) Create a site</div>
                <div className="text-sm text-muted-foreground">
                  Add your first location (address optional). You can add more later.
                </div>
              </div>
              <Button onClick={() => navigate("/app/sites")} className="gap-2">
                <Plus className="w-4 h-4" />
                Create site
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 opacity-70">
              <div className="min-w-0">
                <div className="font-semibold">2) Create checklist templates</div>
                <div className="text-sm text-muted-foreground">
                  Opening, Closing, Delivery, Cleaning… (we’ll build this page next).
                </div>
              </div>
              <Button variant="outline" disabled>
                Next
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 opacity-70">
              <div className="min-w-0">
                <div className="font-semibold">3) Schedule recurring runs</div>
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

  // Normal dashboard
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

          {activeSite?.status && (
            <Badge variant={activeSite.status === "active" ? "default" : "secondary"}>
              {activeSite.status}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!activeCompanyId || !activeSite?.id) return;
              load(activeCompanyId, activeSite.id);
            }}
            disabled={loading || !activeCompanyId || !activeSite?.id}
          >
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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

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

                {(summary?.overdue?.length ?? 0) === 0 && (summary?.dueToday?.length ?? 0) === 0 && (
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
                {summary!.completedToday.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.template_name ?? "Checklist"}</div>
                      <div className="text-xs text-muted-foreground">
                        Completed {r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}
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
                Next: we’ll build the Checklists page (templates + schedule + runs).
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
      <div className="mt-2 text-3xl font-extrabold">
        {loading ? "—" : value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {tone === "danger" ? "Needs action" : tone === "warn" ? "Due today" : "Good progress"}
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
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{title}</div>
          <div className={cn("text-xs", tone === "danger" ? "text-red-600" : "text-muted-foreground")}>
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
