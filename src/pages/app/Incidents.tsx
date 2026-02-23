import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";
import {
  listIncidents,
  listIncidentTemplates,
  type IncidentRow,
  type IncidentType,
  type IncidentTemplateRow,
} from "@/lib/incidents";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Plus, Search } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function typeBadge(t: IncidentRow["type"]) {
  if (t === "accident") return <Badge variant="destructive">Accident</Badge>;
  if (t === "near_miss") return <Badge variant="secondary">Near miss</Badge>;
  return <Badge variant="outline">Incident</Badge>;
}

function templateBadge(tpl: IncidentTemplateRow | undefined, activeCompanyId: string | null) {
  if (!tpl) return null;

  const isCompany = !!activeCompanyId && tpl.company_id === activeCompanyId;
  const isLegal = tpl.company_id === null && tpl.is_legally_approved;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={isLegal ? "secondary" : "outline"}>
        {isLegal ? "Legally approved" : isCompany ? "Company template" : "Template"}
      </Badge>
      <span className="text-xs text-muted-foreground truncate max-w-[240px]">{tpl.name}</span>
    </div>
  );
}

export default function Incidents() {
  const nav = useNavigate();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [q, setQ] = useState("");

  const [templates, setTemplates] = useState<IncidentTemplateRow[]>([]);
  const templatesById = useMemo(() => {
    const m = new Map<string, IncidentTemplateRow>();
    for (const t of templates) m.set(t.id, t);
    return m;
  }, [templates]);

  const [typeFilter, setTypeFilter] = useState<"all" | IncidentType>("all");
  const [templateFilter, setTemplateFilter] = useState<"all" | string>("all");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (templateFilter !== "all" && (r.template_id ?? null) !== templateFilter) return false;

      if (!s) return true;
      return [r.title, r.location ?? "", r.reported_by ?? "", r.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [rows, q, typeFilter, templateFilter]);

  // default for quick "new from template"
  const [newTemplateId, setNewTemplateId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!activeCompanyId || !activeSiteId) return;
      setLoading(true);

      try {
        const [inc, tpls] = await Promise.all([
          listIncidents(activeCompanyId, activeSiteId, 80),
          listIncidentTemplates(activeCompanyId),
        ]);

        setRows(inc);
        setTemplates(tpls);

        // pick a sensible default for "new from template"
        if (!newTemplateId && tpls.length > 0) setNewTemplateId(tpls[0].id);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  const templateOptions = useMemo(() => {
    // sort: legal first, then company, then name
    return [...templates].sort((a, b) => {
      const aLegal = a.company_id === null && a.is_legally_approved ? 0 : 1;
      const bLegal = b.company_id === null && b.is_legally_approved ? 0 : 1;
      if (aLegal !== bLegal) return aLegal - bLegal;

      const aCompany = activeCompanyId && a.company_id === activeCompanyId ? 0 : 1;
      const bCompany = activeCompanyId && b.company_id === activeCompanyId ? 0 : 1;
      if (aCompany !== bCompany) return aCompany - bCompany;

      return a.name.localeCompare(b.name);
    });
  }, [templates, activeCompanyId]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-muted-foreground">
            Log incidents, accidents and near-misses with actions + evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => nav("/app/incidents/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      {/* Quick "New from template" + filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
          <CardDescription>
            Use a legally approved template (or your company version) to standardise incident reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Type</div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="near_miss">Near miss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Template</div>
              <Select value={templateFilter} onValueChange={(v) => setTemplateFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {templateOptions.map((t) => {
                    const isLegal = t.company_id === null && t.is_legally_approved;
                    const isCompany = !!activeCompanyId && t.company_id === activeCompanyId;
                    const label = `${t.name}${isLegal ? " (Legal)" : isCompany ? " (Company)" : ""}`;
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">New from template</div>
              <div className="flex items-center gap-2">
                <Select
                  value={newTemplateId ?? undefined}
                  onValueChange={(v) => setNewTemplateId(v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pick a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateOptions.map((t) => {
                      const isLegal = t.company_id === null && t.is_legally_approved;
                      const isCompany = !!activeCompanyId && t.company_id === activeCompanyId;
                      const label = `${t.name}${isLegal ? " (Legal)" : isCompany ? " (Company)" : ""}`;
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button
                  disabled={!newTemplateId}
                  onClick={() => nav(`/app/incidents/new?templateId=${encodeURIComponent(newTemplateId!)}`)}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register</CardTitle>
          <CardDescription>Latest first. Click an entry to view actions and attachments.</CardDescription>
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
              {filtered.map((r) => {
                const tpl = r.template_id ? templatesById.get(r.template_id) : undefined;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => nav(`/app/incidents/${r.id}`)}
                    className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold truncate">{r.title}</div>
                          {typeBadge(r.type)}
                          <Badge variant={r.status === "open" ? "secondary" : "outline"}>
                            {r.status}
                          </Badge>
                        </div>

                        {/* NEW: show template tag */}
                        {tpl ? templateBadge(tpl, activeCompanyId ?? null) : null}

                        <div className="text-xs text-muted-foreground">
                          {new Date(r.occurred_at).toLocaleString()}
                          {r.location ? ` • ${r.location}` : ""}
                          {r.reported_by ? ` • Reported by ${r.reported_by}` : ""}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}