import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";
import {
  getIncident,
  updateIncident,
  listIncidentActions,
  completeIncidentAction,
  listIncidentTemplates,
  getIncidentTemplateById,
  type IncidentActionRow,
  type IncidentRow,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Save,
  Download,
} from "lucide-react";

const ASSIGNEE_ROLES = [
  { value: "head_office", label: "Head Office" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "head_chef", label: "Head Chef" },
  { value: "restaurant_manager", label: "Restaurant Manager" },
] as const;

type AssigneeRole = (typeof ASSIGNEE_ROLES)[number]["value"];

type AttachmentRow = {
  id: string;
  filename: string | null;
  mime_type: string | null;
  path: string;
  created_at?: string | null;
};

function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false;
  const t = new Date(dueDate).getTime();
  if (Number.isNaN(t)) return false;
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString();
}

function typeBadge(t: IncidentRow["type"]) {
  if (t === "accident") return <Badge variant="destructive">Accident</Badge>;
  if (t === "near_miss") return <Badge variant="secondary">Near miss</Badge>;
  return <Badge variant="outline">Incident</Badge>;
}

function templateKindBadge(
  tpl: IncidentTemplateRow | null,
  companyId: string | null
) {
  if (!tpl) return null;
  const isLegal = tpl.company_id === null && tpl.is_legally_approved;
  const isCompany = !!companyId && tpl.company_id === companyId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={isLegal ? "secondary" : "outline"}>
        {isLegal ? "Legally approved template" : isCompany ? "Company template" : "Template"}
      </Badge>
      <span className="text-xs text-muted-foreground truncate max-w-[360px]">
        {tpl.name}
      </span>
    </div>
  );
}

/**
 * Clickable body map field.
 * Stores region key into form_data[fieldKey].
 */
function BodyMapField(props: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  regions: { key: string; label: string }[];
}) {
  const { label, value, onChange, regions } = props;
  const [side, setSide] = useState<"front" | "back">("front");

  const visibleRegions = useMemo(() => {
    return regions.filter((r) => r.key.startsWith(side));
  }, [regions, side]);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={side === "front" ? "default" : "outline"}
          onClick={() => setSide("front")}
        >
          Front
        </Button>
        <Button
          type="button"
          size="sm"
          variant={side === "back" ? "default" : "outline"}
          onClick={() => setSide("back")}
        >
          Back
        </Button>

        {value ? (
          <Badge variant="secondary">Selected: {value.replaceAll("_", " ")}</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-2">Click an area</div>

          <svg viewBox="0 0 220 420" className="w-full max-w-[260px] mx-auto">
            <path
              d="M110 20
                 C95 20 85 32 85 45
                 C85 62 95 72 110 72
                 C125 72 135 62 135 45
                 C135 32 125 20 110 20 Z
                 M80 90
                 C78 70 92 65 110 65
                 C128 65 142 70 140 90
                 L140 150
                 C140 160 150 170 160 180
                 L175 210
                 C180 220 175 230 165 225
                 L145 195
                 C142 190 138 190 136 200
                 L130 260
                 L145 340
                 C147 355 140 365 128 360
                 L115 300
                 L105 300
                 L92 360
                 C80 365 73 355 75 340
                 L90 260
                 L84 200
                 C82 190 78 190 75 195
                 L55 225
                 C45 230 40 220 45 210
                 L60 180
                 C70 170 80 160 80 150 Z"
              fill="none"
              stroke="currentColor"
              opacity="0.25"
              strokeWidth="2"
            />

            {[
              { key: `${side}_head`, x: 95, y: 22, w: 30, h: 30 },
              { key: `${side}_neck`, x: 100, y: 55, w: 20, h: 15 },
              { key: `${side}_chest`, x: 88, y: 85, w: 44, h: 40 },
              { key: `${side}_abdomen`, x: 90, y: 125, w: 40, h: 40 },
              { key: `${side}_pelvis`, x: 92, y: 165, w: 36, h: 30 },

              { key: `${side}_left_arm`, x: 55, y: 105, w: 22, h: 70 },
              { key: `${side}_right_arm`, x: 143, y: 105, w: 22, h: 70 },

              { key: `${side}_left_hand`, x: 45, y: 185, w: 22, h: 22 },
              { key: `${side}_right_hand`, x: 155, y: 185, w: 22, h: 22 },

              { key: `${side}_left_leg`, x: 86, y: 200, w: 24, h: 90 },
              { key: `${side}_right_leg`, x: 110, y: 200, w: 24, h: 90 },

              { key: `${side}_left_foot`, x: 80, y: 295, w: 26, h: 18 },
              { key: `${side}_right_foot`, x: 114, y: 295, w: 26, h: 18 },

              { key: `${side}_upper_back`, x: 90, y: 95, w: 40, h: 35 },
              { key: `${side}_lower_back`, x: 92, y: 135, w: 36, h: 35 },
            ]
              .filter((z) => regions.some((r) => r.key === z.key))
              .map((z) => {
                const selected = value === z.key;
                return (
                  <rect
                    key={z.key}
                    x={z.x}
                    y={z.y}
                    width={z.w}
                    height={z.h}
                    rx="6"
                    ry="6"
                    fill={selected ? "currentColor" : "transparent"}
                    opacity={selected ? 0.18 : 0.08}
                    stroke="currentColor"
                    strokeOpacity={selected ? 0.55 : 0.25}
                    onClick={() => onChange(z.key)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
          </svg>

          <div className="text-xs text-muted-foreground mt-2">
            Tip: click the diagram or pick from the list.
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-2">Areas ({side})</div>
          <div className="grid grid-cols-1 gap-2">
            {visibleRegions.map((r) => {
              const selected = value === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onChange(r.key)}
                  className={cn(
                    "text-left rounded-md border px-3 py-2 text-sm transition",
                    selected ? "bg-muted border-foreground/20" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{r.label}</span>
                    {selected ? <Badge variant="secondary">selected</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function isFieldVisible(field: any, formData: Record<string, any>) {
  if (!field?.show_if) return true;
  const depKey = field.show_if.key;
  const eq = field.show_if.equals;
  return formData?.[depKey] === eq;
}

export default function IncidentDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState<IncidentRow | null>(null);
  const [actions, setActions] = useState<IncidentActionRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [template, setTemplate] = useState<IncidentTemplateRow | null>(null);

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [completeNotes, setCompleteNotes] = useState<Record<string, string>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [newActionText, setNewActionText] = useState("");
  const [newActionRole, setNewActionRole] =
    useState<AssigneeRole>("restaurant_manager");
  const [newActionDue, setNewActionDue] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const openActions = useMemo(
    () => actions.filter((a) => a.status === "open"),
    [actions]
  );
  const completedActions = useMemo(
    () => actions.filter((a) => a.status === "completed"),
    [actions]
  );

  const schemaSections = useMemo(() => {
    return (template?.schema?.sections ?? []) as any[];
  }, [template]);

  const load = async () => {
    if (!id) return;
    setErr(null);
    setLoading(true);

    try {
      const [inc, acts] = await Promise.all([
        getIncident(id),
        listIncidentActions(id),
      ]);

      setIncident(inc);
      setActions(acts);

      const initialForm = (inc.form_data ?? {}) as Record<string, any>;
      setFormData(initialForm);
      setDirty(false);

      let tpl: IncidentTemplateRow | null = null;

      if (inc.template_id) {
        tpl = await getIncidentTemplateById(inc.template_id);
      } else if (activeCompanyId) {
        const candidates = await listIncidentTemplates(activeCompanyId, inc.type);
        tpl = candidates.find((t) => t.template_key === inc.type) ?? (candidates[0] ?? null);
      }

      setTemplate(tpl);

      const { data: atts, error: attErr } = await supabase
        .from("form_attachments")
        .select("id, filename, mime_type, path, created_at")
        .eq("incident_id", id)
        .order("created_at", { ascending: false });

      if (attErr) throw attErr;
      setAttachments((atts ?? []) as any);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load incident");
      setIncident(null);
      setActions([]);
      setAttachments([]);
      setTemplate(null);
      setFormData({});
      setDirty(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeCompanyId]);

  function setField(key: string, value: any) {
    setFormData((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  async function saveForm() {
    if (!incident) return;
    setSaving(true);
    setErr(null);

    try {
      await updateIncident(incident.id, {
        form_data: formData,
        template_id: incident.template_id ?? template?.id ?? null,
      } as any);

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save form");
    } finally {
      setSaving(false);
    }
  }

  async function downloadIncidentPdf() {
    if (!id) return;
    setErr(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/incident-report-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ incident_id: id }),
        }
      );

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `PDF failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Safyra_Incident_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to download PDF");
    }
  }

  async function addAction() {
    if (!id || !activeCompanyId || !activeSiteId) return;
    const text = newActionText.trim();
    if (!text) return;

    setErr(null);
    const { error } = await supabase.from("incident_actions").insert({
      incident_id: id,
      company_id: activeCompanyId,
      site_id: activeSiteId,
      action_text: text,
      assigned_role: newActionRole,
      due_date: newActionDue || null,
      status: "open",
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setNewActionText("");
    setNewActionDue("");
    await load();
  }

  async function onComplete(actionId: string) {
    const notes = (completeNotes[actionId] ?? "").trim();
    if (!notes) {
      setErr("Please add completion notes before completing.");
      return;
    }

    setErr(null);
    setCompletingId(actionId);
    try {
      await completeIncidentAction(actionId, notes);
      setCompleteNotes((p) => ({ ...p, [actionId]: "" }));
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to complete action");
    } finally {
      setCompletingId(null);
    }
  }

  function onFilesPicked(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function uploadFiles() {
    if (!incident || !activeCompanyId || !activeSiteId) return;
    if (!files.length) return;

    setUploading(true);
    setErr(null);
    try {
      for (const f of files) {
        const safeName = f.name.replace(/[^\w.\-() ]+/g, "_");
        const path = `company/${activeCompanyId}/site/${activeSiteId}/incidents/${incident.id}/${Date.now()}_${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("compliance")
          .upload(path, f, {
            upsert: false,
            contentType: f.type || undefined,
          });
        if (upErr) throw upErr;

        const { error: metaErr } = await supabase.from("form_attachments").insert({
          company_id: activeCompanyId,
          site_id: activeSiteId,
          incident_id: incident.id,
          path,
          filename: f.name,
          mime_type: f.type || null,
        });
        if (metaErr) throw metaErr;
      }

      setFiles([]);
      await load();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage
      .from("compliance")
      .createSignedUrl(path, 60);
    if (error) {
      setErr(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function renderField(f: any) {
    if (!isFieldVisible(f, formData)) return null;

    const rawValue = formData?.[f.key];
    const value = rawValue ?? "";

    // YESNO
    if (f.type === "yesno") {
      const current = rawValue === true ? "yes" : rawValue === false ? "no" : "unset";

      return (
        <div key={f.key} className="space-y-2">
          <div className="text-sm font-medium">
            {f.label} {f.required ? <span className="text-red-600">*</span> : null}
          </div>

          <Select
            value={current}
            onValueChange={(v) =>
              setField(f.key, v === "yes" ? true : v === "no" ? false : null)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Not set</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>

          {f.help ? <div className="text-xs text-muted-foreground">{f.help}</div> : null}
        </div>
      );
    }

    // TEXTAREA
    if (f.type === "textarea") {
      return (
        <div key={f.key} className="space-y-2 md:col-span-2">
          <div className="text-sm font-medium">
            {f.label} {f.required ? <span className="text-red-600">*</span> : null}
          </div>
          <Textarea
            value={String(value ?? "")}
            onChange={(e) => setField(f.key, e.target.value)}
            placeholder={f.placeholder ?? ""}
          />
          {f.help ? <div className="text-xs text-muted-foreground">{f.help}</div> : null}
        </div>
      );
    }

    // BODY MAP
    if (f.type === "body_map") {
      return (
        <div key={f.key} className="md:col-span-2">
          <BodyMapField
            label={f.label}
            value={(formData?.[f.key] ?? null) as any}
            onChange={(v) => setField(f.key, v)}
            regions={f.regions ?? []}
          />
        </div>
      );
    }

    // SELECT / RADIO
    if (f.type === "select" || f.type === "radio") {
      const options = Array.isArray(f.options) ? f.options : [];
      const current = String(value ?? "unset") || "unset";

      return (
        <div key={f.key} className="space-y-2">
          <div className="text-sm font-medium">
            {f.label} {f.required ? <span className="text-red-600">*</span> : null}
          </div>

          <Select value={current} onValueChange={(v) => setField(f.key, v === "unset" ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Not set</SelectItem>
              {options.map((o: any) => (
                <SelectItem key={String(o.value)} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {f.help ? <div className="text-xs text-muted-foreground">{f.help}</div> : null}
        </div>
      );
    }

    // DEFAULT INPUT
    const inputType =
      f.type === "date"
        ? "date"
        : f.type === "time"
        ? "time"
        : f.type === "datetime"
        ? "datetime-local"
        : f.type === "email"
        ? "email"
        : f.type === "tel"
        ? "tel"
        : f.type === "number"
        ? "number"
        : "text";

    return (
      <div key={f.key} className="space-y-2">
        <div className="text-sm font-medium">
          {f.label} {f.required ? <span className="text-red-600">*</span> : null}
        </div>
        <Input
          type={inputType}
          value={
            inputType === "number"
              ? rawValue === null || rawValue === undefined
                ? ""
                : String(rawValue)
              : String(value ?? "")
          }
          onChange={(e) => {
            if (inputType === "number") {
              const v = e.target.value;
              setField(f.key, v === "" ? null : Number(v));
            } else {
              setField(f.key, e.target.value);
            }
          }}
          placeholder={f.placeholder ?? ""}
        />
        {f.help ? <div className="text-xs text-muted-foreground">{f.help}</div> : null}
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!incident) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => nav("/app/incidents")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Unable to load incident.
        </div>
        {err ? <div className="text-sm text-red-700">{err}</div> : null}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold truncate">{incident.title}</h1>
            {typeBadge(incident.type)}
            <Badge variant={incident.status === "open" ? "secondary" : "outline"}>
              {incident.status}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground">
            Occurred: {formatDateTime(incident.occurred_at)}
            {incident.location ? ` • ${incident.location}` : ""}
            {incident.reported_by ? ` • Reported by ${incident.reported_by}` : ""}
          </div>

          {templateKindBadge(template, activeCompanyId ?? null)}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => nav("/app/incidents")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <Button variant="outline" onClick={downloadIncidentPdf} className="gap-2">
            <Download className="w-4 h-4" />
            PDF
          </Button>

          <Button onClick={saveForm} disabled={saving || !dirty} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Template-driven form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incident form</CardTitle>
          <CardDescription>
            Driven by the selected template (legal or your company version).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!template ? (
            <div className="text-sm text-muted-foreground">
              No template found for this incident type.
            </div>
          ) : schemaSections.length === 0 ? (
            <div className="text-sm text-muted-foreground">Template schema has no sections.</div>
          ) : (
            schemaSections.map((sec, idx) => (
              <div
                key={`${sec.title ?? "section"}-${idx}`}
                className="rounded-lg border p-4 space-y-4"
              >
                <div>
                  <div className="font-semibold">{sec.title}</div>
                  {sec.description ? (
                    <div className="text-sm text-muted-foreground">{sec.description}</div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(sec.fields ?? []).map((f: any) => renderField(f))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>Assign tasks and complete them with notes (inspection-ready).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="font-medium">Add action</div>
            <Textarea
              value={newActionText}
              onChange={(e) => setNewActionText(e.target.value)}
              placeholder="e.g. Replace broken tile, retrain staff on manual handling…"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Assigned to</div>
                <Select value={newActionRole} onValueChange={(v) => setNewActionRole(v as AssigneeRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNEE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Due date</div>
                <Input type="date" value={newActionDue} onChange={(e) => setNewActionDue(e.target.value)} />
              </div>

              <div className="flex items-end justify-end">
                <Button onClick={addAction} disabled={!newActionText.trim()} className="w-full md:w-auto">
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <div className="font-medium">Open</div>
              <Badge variant={openActions.length ? "destructive" : "secondary"}>
                {openActions.length}
              </Badge>
            </div>

            {openActions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No open actions ✅</div>
            ) : (
              openActions.map((a) => {
                const overdue = isOverdue(a.due_date);
                return (
                  <div
                    key={a.id}
                    className={cn("rounded-lg border p-3 space-y-2", overdue && "border-red-200")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold whitespace-pre-line">{a.action_text}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {a.assigned_role ? `Assigned: ${a.assigned_role.replaceAll("_", " ")}` : "Unassigned"}
                          {" • "}
                          Due:{" "}
                          <span className={cn(overdue && "text-red-600 font-medium")}>
                            {a.due_date ?? "—"}
                          </span>
                        </div>
                      </div>
                      <Badge variant={overdue ? "destructive" : "secondary"}>
                        {overdue ? "overdue" : "open"}
                      </Badge>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Completion notes (required)</div>
                      <Input
                        className="mt-2"
                        value={completeNotes[a.id] ?? ""}
                        onChange={(e) => setCompleteNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                        placeholder='e.g. "Area repaired, staff briefed, follow-up scheduled."'
                      />
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => onComplete(a.id)}
                          disabled={completingId === a.id}
                          className="gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {completingId === a.id ? "Completing…" : "Complete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <div className="font-medium">Completed</div>
              <Badge variant="secondary">{completedActions.length}</Badge>
            </div>

            {completedActions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed actions yet.</div>
            ) : (
              completedActions.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold whitespace-pre-line">{a.action_text}</div>
                    <Badge variant="secondary">completed</Badge>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="text-xs text-muted-foreground">What was done</div>
                    <div className="mt-1 whitespace-pre-line">{a.action_completed_notes || "—"}</div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Completed: {formatDateTime(a.action_completed_at)} • Original due: {a.due_date ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Attachments
          </CardTitle>
          <CardDescription>Upload photos, witness statements, reports, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <Input type="file" multiple onChange={(e) => onFilesPicked(e.target.files)} />
            <Button onClick={uploadFiles} disabled={!files.length || uploading} className="gap-2 md:w-auto">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {files.length ? <div className="text-sm text-muted-foreground">{files.length} file(s) selected</div> : null}

          {attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No attachments yet.</div>
          ) : (
            <div className="space-y-2">
              {attachments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openAttachment(a.path)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.filename ?? a.path}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.mime_type ?? "file"} • {a.created_at ? formatDateTime(a.created_at) : ""}
                      </div>
                    </div>
                    <Badge variant="outline">open</Badge>
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