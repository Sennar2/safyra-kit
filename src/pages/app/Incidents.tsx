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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import IncidentStats from "@/components/incidents/IncidentStats";
import IncidentExport from "@/components/incidents/IncidentExport";

function typeBadge(t: IncidentRow["type"]) {
  if (t === "accident") return <Badge variant="destructive">Accident</Badge>;
  if (t === "near_miss") return <Badge variant="secondary">Near miss</Badge>;
  return <Badge variant="outline">Incident</Badge>;
}

function templateBadge(
  tpl: IncidentTemplateRow | undefined,
  activeCompanyId: string | null
) {
  if (!tpl) return null;

  const isCompany =
    !!activeCompanyId && tpl.company_id === activeCompanyId;
  const isLegal =
    tpl.company_id === null && tpl.is_legally_approved;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={isLegal ? "secondary" : "outline"}>
        {isLegal
          ? "Legally approved"
          : isCompany
          ? "Company template"
          : "Template"}
      </Badge>
      <span className="text-xs text-muted-foreground truncate max-w-[240px]">
        {tpl.name}
      </span>
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

  const [typeFilter, setTypeFilter] =
    useState<"all" | IncidentType>("all");
  const [templateFilter, setTemplateFilter] =
    useState<"all" | string>("all");

  const [newTemplateId, setNewTemplateId] =
    useState<string | null>(null);

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

        if (!newTemplateId && tpls.length > 0)
          setNewTemplateId(tpls[0].id);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter)
        return false;
      if (
        templateFilter !== "all" &&
        (r.template_id ?? null) !== templateFilter
      )
        return false;

      if (!s) return true;

      return [
        r.title,
        r.location ?? "",
        r.reported_by ?? "",
        r.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [rows, q, typeFilter, templateFilter]);

  const templateOptions = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aLegal =
        a.company_id === null && a.is_legally_approved ? 0 : 1;
      const bLegal =
        b.company_id === null && b.is_legally_approved ? 0 : 1;
      if (aLegal !== bLegal) return aLegal - bLegal;
      return a.name.localeCompare(b.name);
    });
  }, [templates]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <p className="text-muted-foreground">
          Log incidents, accidents and near-misses with actions
          and evidence.
        </p>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* ================= LIST TAB ================= */}
        <TabsContent value="list" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => nav("/app/incidents/new")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 p-6">
              <Select
                value={typeFilter}
                onValueChange={(v) =>
                  setTypeFilter(v as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="incident">
                    Incident
                  </SelectItem>
                  <SelectItem value="accident">
                    Accident
                  </SelectItem>
                  <SelectItem value="near_miss">
                    Near miss
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={templateFilter}
                onValueChange={(v) =>
                  setTemplateFilter(v as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All templates
                  </SelectItem>
                  {templateOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) =>
                    setQ(e.target.value)
                  }
                  placeholder="Search…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Register */}
          <Card>
            <CardHeader>
              <CardTitle>Register</CardTitle>
              <CardDescription>
                Latest first. Click to open.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  No incidents logged yet.
                </div>
              ) : (
                filtered.map((r) => {
                  const tpl = r.template_id
                    ? templatesById.get(r.template_id)
                    : undefined;

                  return (
                    <button
                      key={r.id}
                      onClick={() =>
                        nav(`/app/incidents/${r.id}`)
                      }
                      className="w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">
                          {r.title}
                        </div>
                        {typeBadge(r.type)}
                        <Badge
                          variant={
                            r.status === "open"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {r.status}
                        </Badge>
                      </div>

                      {tpl
                        ? templateBadge(
                            tpl,
                            activeCompanyId ?? null
                          )
                        : null}

                      <div className="text-xs text-muted-foreground">
                        {new Date(
                          r.occurred_at
                        ).toLocaleString()}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= STATS TAB ================= */}
        <TabsContent value="stats">
          <IncidentStats />
        </TabsContent>

        {/* ================= EXPORT TAB ================= */}
        <TabsContent value="export">
          <IncidentExport />
        </TabsContent>
      </Tabs>
    </div>
  );
}