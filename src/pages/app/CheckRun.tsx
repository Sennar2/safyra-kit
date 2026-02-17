import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";
import {
  completeRun,
  getRun,
  listRunItems,
  updateRunItem,
  type ChecklistRunItemRow,
  type ChecklistRunRow,
} from "@/lib/checks";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, CircleDashed, MinusCircle } from "lucide-react";

export default function CheckRun() {
  const navigate = useNavigate();
  const { runId } = useParams();
  const { activeCompanyId } = useTenant();

  const [run, setRun] = useState<ChecklistRunRow | null>(null);
  const [items, setItems] = useState<ChecklistRunItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done").length;
    const na = items.filter((i) => i.status === "na").length;
    const pending = items.filter((i) => i.status === "pending").length;
    return { total, done, na, pending };
  }, [items]);

  const canComplete = useMemo(() => {
    if (!run) return false;
    if (run.status === "completed") return false;
    return stats.pending === 0 && stats.total > 0;
  }, [run, stats.pending, stats.total]);

  const load = async () => {
    if (!runId) return;
    setErr(null);
    setLoading(true);
    try {
      const r = await getRun(runId);
      setRun(r);

      // safety: must match active company context
      if (activeCompanyId && r.company_id !== activeCompanyId) {
        setErr("This run belongs to a different company. Go back to Hub and select the right company.");
        setItems([]);
        return;
      }

      const it = await listRunItems(runId);
      setItems(it.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load run");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const setStatus = async (runItemId: string, status: "pending" | "done" | "na") => {
    setSavingId(runItemId);
    setErr(null);
    try {
      await updateRunItem({ runItemId, status });
      setItems((prev) =>
        prev.map((x) =>
          x.id === runItemId
            ? {
                ...x,
                status,
                completed_at: status === "pending" ? null : new Date().toISOString(),
              }
            : x
        )
      );
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to update item");
    } finally {
      setSavingId(null);
    }
  };

  const setNotes = async (runItemId: string, notes: string) => {
    setSavingId(runItemId);
    setErr(null);
    try {
      await updateRunItem({ runItemId, notes: notes.trim() ? notes : null });
      setItems((prev) => prev.map((x) => (x.id === runItemId ? { ...x, notes } : x)));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to save notes");
    } finally {
      setSavingId(null);
    }
  };

  const doComplete = async () => {
    if (!runId) return;
    setCompleting(true);
    setErr(null);
    try {
      const updated = await completeRun(runId);
      setRun((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to complete run");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" className="gap-2 -ml-2" onClick={() => navigate("/app/checks")}>
            <ArrowLeft className="w-4 h-4" />
            Back to checklists
          </Button>

          <h1 className="text-3xl font-extrabold tracking-tight mt-2">
            {run?.template_name ?? "Checklist run"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {run?.site_name ? `Site: ${run.site_name}` : "Site"} • Run ID:{" "}
            <span className="font-mono text-xs">{runId}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {run?.status && (
            <Badge variant={run.status === "completed" ? "secondary" : "default"}>{run.status}</Badge>
          )}
          <Button onClick={doComplete} disabled={!canComplete || completing}>
            Complete run
          </Button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Done</CardDescription>
            <CardTitle className="text-3xl">{stats.done}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>N/A</CardDescription>
            <CardTitle className="text-3xl">{stats.na}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>Mark each item as Done / N/A. Add notes if needed.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items found for this run.</div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => {
                const busy = savingId === it.id || run?.status === "completed";
                const isDone = it.status === "done";
                const isNa = it.status === "na";
                const isPending = it.status === "pending";

                return (
                  <div
                    key={it.id}
                    className={cn(
                      "rounded-xl border border-border p-4",
                      isDone && "bg-muted/30",
                      isNa && "bg-muted/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold truncate">{it.title ?? "Item"}</div>
                          {it.is_required ? (
                            <Badge variant="outline">Required</Badge>
                          ) : (
                            <Badge variant="secondary">Optional</Badge>
                          )}
                          {it.photo_required ? <Badge variant="outline">Photo</Badge> : null}
                        </div>

                        {it.description ? (
                          <div className="text-xs text-muted-foreground mt-1">{it.description}</div>
                        ) : null}

                        <div className="text-xs text-muted-foreground mt-2">
                          Status:{" "}
                          <span className="font-medium">
                            {it.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={isDone ? "default" : "outline"}
                          className="gap-2"
                          disabled={busy}
                          onClick={() => setStatus(it.id, "done")}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Done
                        </Button>
                        <Button
                          variant={isNa ? "secondary" : "outline"}
                          className="gap-2"
                          disabled={busy}
                          onClick={() => setStatus(it.id, "na")}
                        >
                          <MinusCircle className="w-4 h-4" />
                          N/A
                        </Button>
                        <Button
                          variant={isPending ? "outline" : "ghost"}
                          className="gap-2"
                          disabled={busy}
                          onClick={() => setStatus(it.id, "pending")}
                        >
                          <CircleDashed className="w-4 h-4" />
                          Pending
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Notes</div>
                      <Textarea
                        defaultValue={it.notes ?? ""}
                        disabled={run?.status === "completed"}
                        placeholder="Add notes (optional)…"
                        onBlur={(e) => setNotes(it.id, e.target.value)}
                      />
                      <div className="text-[11px] text-muted-foreground">
                        Tip: notes save when you click outside the box.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            Completing is enabled only when <b>Pending = 0</b>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
