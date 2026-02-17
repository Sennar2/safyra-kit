import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Filter, Plus, Trash2 } from "lucide-react";

import { useTenant } from "@/lib/tenantContext";

import {
  listSites,
  listChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  listTemplateItems,
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  startChecklistRun,
  listRunsFiltered,
  listTodaysRuns,
  type SiteRow,
  type ChecklistTemplateRow,
  type ChecklistTemplateItemRow,
  type ChecklistRunRow,
} from "@/lib/checks";

import {
  listSchedules,
  createSchedule,
  setScheduleActive,
  deleteSchedule,
} from "@/lib/schedules";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScheduleRow = {
  id: string;
  company_id: string;
  site_id: string;
  template_id: string;
  active: boolean;
  timezone: string;
  due_time: string; // "14:00:00"
  recurrence: "daily" | "weekly" | "monthly";
  weekdays: number[] | null; // 1..7
  monthday: number | null;   // 1..31
  start_date: string;        // YYYY-MM-DD
  end_date: string | null;   // YYYY-MM-DD
  created_at: string;
};

const WEEKDAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

function fmtDueTime(t: string) {
  // "14:00:00" -> "14:00"
  if (!t) return "—";
  return t.slice(0, 5);
}

export default function DailyChecks() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { activeCompanyId, activeSiteId, setActiveSiteId } = useTenant();

  // Sites
  const [sites, setSites] = useState<SiteRow[]>([]);
  const activeSite = useMemo(
    () => sites.find((s) => s.id === activeSiteId) ?? null,
    [sites, activeSiteId]
  );

  // Templates
  const [templates, setTemplates] = useState<ChecklistTemplateRow[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Template items
  const [items, setItems] = useState<ChecklistTemplateItemRow[]>([]);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(true);

  // Runs
  const [runs, setRuns] = useState<ChecklistRunRow[]>([]);
  const [todayRuns, setTodayRuns] = useState<ChecklistRunRow[]>([]);

  const [runStatus, setRunStatus] = useState<string>("all"); // all | open | completed
  const [runTemplateId, setRunTemplateId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(""); // yyyy-mm-dd
  const [toDate, setToDate] = useState<string>("");   // yyyy-mm-dd
  const [runsLoading, setRunsLoading] = useState(false);

  // Schedules
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  const [schedTemplateId, setSchedTemplateId] = useState<string>("");
  const [schedDueTime, setSchedDueTime] = useState<string>("14:00"); // default 2pm
  const [schedRecurrence, setSchedRecurrence] = useState<"daily" | "weekly" | "monthly">("daily");
  const [schedWeekdays, setSchedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [schedMonthday, setSchedMonthday] = useState<number>(1);
  const [schedStartDate, setSchedStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [schedEndDate, setSchedEndDate] = useState<string>("");

  // ---------------------------
  // LOADERS
  // ---------------------------
  const loadSites = async () => {
    if (!activeCompanyId) return;
    const rows = await listSites(activeCompanyId);
    setSites(rows);

    // If no active site selected, pick first
    if (!activeSiteId && rows.length > 0) {
      setActiveSiteId(rows[0].id);
    }
  };

  const loadTemplates = async () => {
    if (!activeCompanyId) return;
    const rows = await listChecklistTemplates(activeCompanyId);
    setTemplates(rows);

    // keep selection stable
    if (!selectedTemplateId && rows.length > 0) setSelectedTemplateId(rows[0].id);
    if (!schedTemplateId && rows.length > 0) setSchedTemplateId(rows[0].id);
  };

  const loadTemplateItems = async (templateId: string) => {
    if (!templateId) {
      setItems([]);
      return;
    }
    const rows = await listTemplateItems(templateId);
    setItems(rows);
  };

  const loadTodayRuns = async () => {
    if (!activeCompanyId || !activeSiteId) return;
    const rows = await listTodaysRuns({ companyId: activeCompanyId, siteId: activeSiteId, limit: 50 });
    setTodayRuns(rows);
  };

  const loadFilteredRuns = async () => {
    if (!activeCompanyId || !activeSiteId) return;

    setRunsLoading(true);
    try {
      const fromIso = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
      const toIso = toDate ? new Date(`${toDate}T00:00:00`).toISOString() : undefined;

      const rows = await listRunsFiltered({
        companyId: activeCompanyId,
        siteId: activeSiteId,
        status: runStatus === "all" ? undefined : runStatus,
        templateId: runTemplateId === "all" ? undefined : runTemplateId,
        fromIso,
        toIso,
        limit: 50,
      });

      setRuns(rows);
    } finally {
      setRunsLoading(false);
    }
  };

  const loadSchedules = async () => {
    if (!activeCompanyId || !activeSiteId) return;
    setSchedulesLoading(true);
    try {
      const rows = await listSchedules(activeCompanyId, activeSiteId);
      setSchedules(rows as ScheduleRow[]);
    } finally {
      setSchedulesLoading(false);
    }
  };

  // ---------------------------
  // EFFECTS
  // ---------------------------
  useEffect(() => {
    (async () => {
      try {
        await loadSites();
        await loadTemplates();
      } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e?.message ?? "Failed to load data", variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    (async () => {
      try {
        await loadTemplateItems(selectedTemplateId);
      } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e?.message ?? "Failed to load template items", variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!activeCompanyId || !activeSiteId) return;
    (async () => {
      try {
        await loadTodayRuns();
        await loadFilteredRuns();
        await loadSchedules();
      } catch (e: any) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  // Runs auto reload when filters change
  useEffect(() => {
    if (!activeCompanyId || !activeSiteId) return;
    loadFilteredRuns().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus, runTemplateId, fromDate, toDate]);

  // ---------------------------
  // ACTIONS: Templates
  // ---------------------------
  const onCreateTemplate = async () => {
    if (!activeCompanyId) return;
    if (!templateName.trim()) {
      toast({ title: "Missing name", description: "Give the template a name.", variant: "destructive" });
      return;
    }
    try {
      const t = await createChecklistTemplate(activeCompanyId, templateName.trim());
      toast({ title: "Template created", description: t.name });
      setTemplateName("");
      await loadTemplates();
      setSelectedTemplateId(t.id);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to create template", variant: "destructive" });
    }
  };

  const onRenameTemplate = async (templateId: string, name: string) => {
    const next = prompt("Rename template:", name);
    if (!next || !next.trim()) return;
    try {
      await updateChecklistTemplate(templateId, { name: next.trim() });
      toast({ title: "Updated" });
      await loadTemplates();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to update template", variant: "destructive" });
    }
  };

  const onDeleteTemplate = async (templateId: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteChecklistTemplate(templateId);
      toast({ title: "Deleted" });
      setSelectedTemplateId("");
      setItems([]);
      await loadTemplates();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to delete template", variant: "destructive" });
    }
  };

  // ---------------------------
  // ACTIONS: Template items
  // ---------------------------
  const onAddItem = async () => {
    if (!selectedTemplateId) return;
    if (!newItemLabel.trim()) return;

    try {
      await createTemplateItem(selectedTemplateId, {
        label: newItemLabel.trim(),
        required: newItemRequired,
      });
      setNewItemLabel("");
      setNewItemRequired(true);
      await loadTemplateItems(selectedTemplateId);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to add item", variant: "destructive" });
    }
  };

  const onToggleRequired = async (item: ChecklistTemplateItemRow) => {
    try {
      await updateTemplateItem(item.id, { required: !item.required });
      await loadTemplateItems(selectedTemplateId);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to update item", variant: "destructive" });
    }
  };

  const onEditItem = async (item: ChecklistTemplateItemRow) => {
    const next = prompt("Edit item label:", item.label);
    if (!next || !next.trim()) return;

    try {
      await updateTemplateItem(item.id, { label: next.trim() });
      await loadTemplateItems(selectedTemplateId);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to update item", variant: "destructive" });
    }
  };

  const onDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this item?")) return;
    try {
      await deleteTemplateItem(itemId);
      await loadTemplateItems(selectedTemplateId);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to delete item", variant: "destructive" });
    }
  };

  // ---------------------------
  // ACTIONS: Runs
  // ---------------------------
  const onStartRun = async (templateId: string) => {
    if (!activeCompanyId || !activeSiteId) return;
    try {
      const run = await startChecklistRun({
        companyId: activeCompanyId,
        siteId: activeSiteId,
        templateId,
      });
      toast({ title: "Run started" });
      // If you have a run page, go to it
      navigate(`/app/checks/run/${run.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to start run", variant: "destructive" });
    }
  };

  // ---------------------------
  // ACTIONS: Schedules
  // ---------------------------
  const toggleWeekday = (d: number) => {
    setSchedWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const onCreateSchedule = async () => {
    if (!activeCompanyId || !activeSiteId) return;

    if (!schedTemplateId) {
      toast({ title: "Pick a template", variant: "destructive" });
      return;
    }

    if (!schedDueTime || schedDueTime.length < 4) {
      toast({ title: "Pick a due time", description: "Example: 14:00", variant: "destructive" });
      return;
    }

    if (schedRecurrence === "weekly" && schedWeekdays.length === 0) {
      toast({ title: "Pick weekdays", description: "Select at least one weekday.", variant: "destructive" });
      return;
    }

    if (schedRecurrence === "monthly" && (!schedMonthday || schedMonthday < 1 || schedMonthday > 31)) {
      toast({ title: "Invalid month day", description: "Must be 1–31", variant: "destructive" });
      return;
    }

    try {
      await createSchedule({
        companyId: activeCompanyId,
        siteId: activeSiteId,
        templateId: schedTemplateId,
        dueTime: schedDueTime,
        timezone: "Europe/London",
        recurrence: schedRecurrence,
        weekdays: schedRecurrence === "weekly" ? schedWeekdays : undefined,
        monthday: schedRecurrence === "monthly" ? schedMonthday : undefined,
        startDate: schedStartDate,
        endDate: schedEndDate ? schedEndDate : null,
        active: true,
      });

      toast({ title: "Schedule created" });
      await loadSchedules();
      await loadTodayRuns();
      await loadFilteredRuns();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to create schedule", variant: "destructive" });
    }
  };

  const onToggleScheduleActive = async (row: ScheduleRow, active: boolean) => {
    try {
      await setScheduleActive(row.id, active);
      await loadSchedules();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to update schedule", variant: "destructive" });
    }
  };

  const onDeleteSchedule = async (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    try {
      await deleteSchedule(id);
      await loadSchedules();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "Failed to delete schedule", variant: "destructive" });
    }
  };

  // ---------------------------
  // UI helpers
  // ---------------------------
  const templateNameById = useMemo(() => {
    const m = new Map<string, string>();
    templates.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [templates]);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Daily Checks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build checklists, schedule them, and record completed runs.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Active site</div>
              <div className="font-semibold truncate">{activeSite?.name ?? "— Select a site —"}</div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Select value={activeSiteId ?? ""} onValueChange={setActiveSiteId}>
                <SelectTrigger className="h-10 w-full md:w-[260px]">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => { loadSites(); loadSchedules(); loadTodayRuns(); loadFilteredRuns(); }}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="mt-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        {/* ---------------- TEMPLATES ---------------- */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create template</CardTitle>
              <CardDescription>Opening, Closing, Delivery checks, etc.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Opening checks"
              />
              <Button onClick={onCreateTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Template list */}
            <Card>
              <CardHeader>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Select one to edit items.</CardDescription>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No templates yet.</div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => {
                      const selected = t.id === selectedTemplateId;
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-lg border border-border p-3",
                            selected ? "bg-muted/60" : "bg-background"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.created_at ? new Date(t.created_at).toLocaleString() : ""}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant={selected ? "default" : "outline"} onClick={() => setSelectedTemplateId(t.id)}>
                              {selected ? "Selected" : "Select"}
                            </Button>
                            <Button variant="outline" onClick={() => onStartRun(t.id)}>
                              Start run
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template editor */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Template items</CardTitle>
                  <CardDescription>Add/edit the checklist steps.</CardDescription>
                </div>
                {selectedTemplateId && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const t = templates.find((x) => x.id === selectedTemplateId);
                        if (!t) return;
                        onRenameTemplate(t.id, t.name);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => onDeleteTemplate(selectedTemplateId)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                {!selectedTemplateId ? (
                  <div className="text-sm text-muted-foreground">Select a template to edit it.</div>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row gap-2">
                      <Input
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        placeholder="e.g. Sanitise surfaces"
                      />
                      <div className="flex items-center gap-2">
                        <Switch checked={newItemRequired} onCheckedChange={setNewItemRequired} />
                        <span className="text-sm text-muted-foreground">Required</span>
                      </div>
                      <Button onClick={onAddItem} className="md:w-[160px]">
                        Add item
                      </Button>
                    </div>

                    <Separator className="my-4" />

                    {items.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No items yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{it.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {it.required ? "Required" : "Optional"}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => onEditItem(it)}>
                                Edit
                              </Button>
                              <Button variant="outline" onClick={() => onToggleRequired(it)}>
                                Toggle
                              </Button>
                              <Button variant="destructive" onClick={() => onDeleteItem(it.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- SCHEDULES ---------------- */}
        <TabsContent value="schedules" className="mt-4 space-y-4">
          {!activeSiteId ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Select a site first.</CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Create schedule</CardTitle>
                  <CardDescription>
                    Auto-create runs (e.g. Opening checklist due by 14:00, daily/weekly/monthly).
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Template</div>
                      <Select value={schedTemplateId} onValueChange={setSchedTemplateId}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Due time</div>
                      <Input
                        type="time"
                        value={schedDueTime}
                        onChange={(e) => setSchedDueTime(e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Recurrence</div>
                      <Select value={schedRecurrence} onValueChange={(v) => setSchedRecurrence(v as any)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {schedRecurrence === "weekly" && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Weekdays</div>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((d) => {
                          const on = schedWeekdays.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              onClick={() => toggleWeekday(d.value)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg border text-sm transition",
                                on
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border text-foreground hover:bg-muted"
                              )}
                              type="button"
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {schedRecurrence === "monthly" && (
                    <div className="max-w-[240px]">
                      <div className="text-xs text-muted-foreground mb-1">Day of month (1–31)</div>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={schedMonthday}
                        onChange={(e) => setSchedMonthday(Number(e.target.value))}
                        className="h-10"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Start date</div>
                      <Input
                        type="date"
                        value={schedStartDate}
                        onChange={(e) => setSchedStartDate(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">End date (optional)</div>
                      <Input
                        type="date"
                        value={schedEndDate}
                        onChange={(e) => setSchedEndDate(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={onCreateSchedule} className="w-full h-10">
                        <Plus className="w-4 h-4 mr-2" />
                        Create schedule
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Tip: The Edge Function will create runs automatically (no duplicates) based on these schedules.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>Schedules</CardTitle>
                    <CardDescription>These generate runs automatically.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={loadSchedules} disabled={schedulesLoading}>
                    Refresh
                  </Button>
                </CardHeader>

                <CardContent>
                  {schedulesLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : schedules.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No schedules yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {schedules.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {templateNameById.get(s.template_id) ?? "Checklist"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.recurrence} • due {fmtDueTime(s.due_time)} • {s.timezone}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {s.start_date}
                              {s.end_date ? ` → ${s.end_date}` : ""}
                              {s.recurrence === "weekly" && s.weekdays?.length
                                ? ` • ${s.weekdays.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).filter(Boolean).join(", ")}`
                                : ""}
                              {s.recurrence === "monthly" && s.monthday ? ` • day ${s.monthday}` : ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Switch checked={!!s.active} onCheckedChange={(v) => onToggleScheduleActive(s, v)} />
                              <span className="text-sm text-muted-foreground">{s.active ? "Active" : "Off"}</span>
                            </div>

                            <Button variant="destructive" onClick={() => onDeleteSchedule(s.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ---------------- RUNS ---------------- */}
        <TabsContent value="runs" className="mt-4">
          {!activeSiteId ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Select a site to view runs.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* TODAY */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5" />
                      Today’s runs
                    </CardTitle>
                    <CardDescription>Runs due today for this site (based on due time).</CardDescription>
                  </div>
                  <Button variant="outline" onClick={loadTodayRuns}>
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {todayRuns.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No runs due today.</div>
                  ) : (
                    <div className="space-y-2">
                      {todayRuns.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{r.template_name ?? "Checklist"}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.status}
                              {r.due_at ? ` • due ${new Date(r.due_at).toLocaleTimeString()}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={r.status === "completed" ? "secondary" : "default"}>{r.status}</Badge>
                            <Button variant="outline" onClick={() => navigate(`/app/checks/run/${r.id}`)}>
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* FILTERS + LIST */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5" />
                      Runs
                    </CardTitle>
                    <CardDescription>Filter by status, template, and date range.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={loadFilteredRuns} disabled={runsLoading}>
                    Apply
                  </Button>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Status</div>
                      <Select value={runStatus} onValueChange={setRunStatus}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Template</div>
                      <Select value={runTemplateId} onValueChange={setRunTemplateId}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">From</div>
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">To</div>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  {runsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : runs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No runs match these filters.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{r.template_name ?? "Checklist"}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.status} • created {new Date(r.created_at).toLocaleString()}
                              {r.due_at ? ` • due ${new Date(r.due_at).toLocaleString()}` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{r.id}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={r.status === "completed" ? "secondary" : "default"}>{r.status}</Badge>
                            <Button variant="outline" onClick={() => navigate(`/app/checks/run/${r.id}`)}>
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 text-xs text-muted-foreground">
                    Tip: Schedules generate runs automatically. You can still “Start run” manually from Templates.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
