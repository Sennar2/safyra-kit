import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";
import { listIncidents, type IncidentRow } from "@/lib/incidents";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Plus, Search } from "lucide-react";

function typeBadge(t: IncidentRow["type"]) {
  if (t === "accident") return <Badge variant="destructive">Accident</Badge>;
  if (t === "near_miss") return <Badge variant="secondary">Near miss</Badge>;
  return <Badge variant="outline">Incident</Badge>;
}

export default function Incidents() {
  const nav = useNavigate();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.title, r.location ?? "", r.reported_by ?? "", r.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeCompanyId || !activeSiteId) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await listIncidents(activeCompanyId, activeSiteId, 80);
        if (!alive) return;
        setRows(data);
      } catch (e) {
        console.error("listIncidents error:", e);
        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeCompanyId, activeSiteId]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-muted-foreground">
            Log incidents, accidents and near-misses with actions + evidence.
          </p>
        </div>

        <Button onClick={() => nav("/app/incidents/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          New
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register</CardTitle>
          <CardDescription>
            Latest first. Click an entry to view actions and attachments.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, location, reporter…"
            />
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              No incidents logged yet.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => nav(`/app/incidents/${r.id}`)}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/40 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold truncate">{r.title}</div>
                        {typeBadge(r.type)}
                        <Badge
                          variant={r.status === "open" ? "secondary" : "outline"}
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(r.occurred_at).toLocaleString()}
                        {r.location ? ` • ${r.location}` : ""}
                        {r.reported_by ? ` • Reported by ${r.reported_by}` : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}