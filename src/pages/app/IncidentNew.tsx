import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";
import {
  listIncidentTemplates,
  type IncidentTemplateRow,
  type IncidentType,
} from "@/lib/incidents";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, Save, Trash2, Upload } from "lucide-react";

const ASSIGNEE_ROLES = [
  { value: "head_office", label: "Head Office" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "head_chef", label: "Head Chef" },
  { value: "restaurant_manager", label: "Restaurant Manager" },
] as const;

type AssigneeRole = (typeof ASSIGNEE_ROLES)[number]["value"];

type ActionDraft = {
  action_text: string;
  assigned_role: AssigneeRole;
  due_date: string; // date-only string
};

function templateKindLabel(t: IncidentTemplateRow, companyId: string | null) {
  const isLegal = t.company_id === null && t.is_legally_approved;
  const isCompany = !!companyId && t.company_id === companyId;
  return isLegal ? "Legal" : isCompany ? "Company" : "Template";
}

/**
 * Clickable body map field.
 * Stores region key in form_data[fieldKey].
 */
function BodyMapField(props: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  regions: { key: string; label: string }[];
}) {
  const { label, value, onChange, regions } = props;
  const [side, setSide] = useState<"front" | "back">("front");

  const visibleRegions = useMemo(() => regions.filter((r) => r.key.startsWith(side)), [regions, side]);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant={side === "front" ? "default" : "outline"} onClick={() => setSide("front")}>
          Front
        </Button>
        <Button type="button" size="sm" variant={side === "back" ? "default" : "outline"} onClick={() => setSide("back")}>
          Back
        </Button>
        {value ? <Badge variant="secondary">Selected: {value.replaceAll("_", " ")}</Badge> : null}
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

          <div className="text-xs text-muted-foreground mt-2">Tip: click the diagram or pick from the list.</div>
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

export default function IncidentNew() {
  const nav = useNavigate();
  const { activeCompanyId, activeSiteId } = useTenant();

  // core fields
  const [type, setType] = useState<IncidentType>("incident");
  const [occurredAt, setOccurredAt] = useState<string>(""); // datetime-local string
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [description, setDescription] = useState("");
  const [immediateAction, setImmediateAction] = useState("");

  // templates
  const [templates, setTemplates] = useState<IncidentTemplateRow[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // actions draft
  const [actions, setActions] = useState<ActionDraft[]>([
    { action_text: "", assigned_role: "restaurant_manager", due_date: "" },
  ]);

  // attachments
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // status
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setField(key: string, value: any) {
    setFormData((p) => ({ ...p, [key]: value }));
  }

  // load templates whenever company or type changes
  useEffect(() => {
    (async () => {
      if (!activeCompanyId) return;
      setLoadingTemplates(true);
      setErr(null);
      try {
        const tpls = await listIncidentTemplates(activeCompanyId, type);
        setTemplates(tpls);

        // pick default template for this type
        const preferred = tpls.find((t) => t.template_key === type) ?? tpls[0] ?? null;
        setTemplateId(preferred?.id ?? "");
        setFormData({});
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? "Failed to load templates");
        setTemplates([]);
        setTemplateId("");
        setFormData({});
      } finally {
        setLoadingTemplates(false);
      }
    })();
  }, [activeCompanyId, type]);

  function onFilesPicked(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function save() {
    if (!activeCompanyId || !activeSiteId) {
      setErr("Missing company/site context.");
      return;
    }

    const t = title.trim();
    if (!t) {
      setErr("Title is required.");
      return;
    }
    if (!occurredAt) {
      setErr("Occurred at is required.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      // Create incident (direct insert so we can include immediate_action even if your lib type doesn't)
      const { data: created, error: incErr } = await supabase
        .from("incidents")
        .insert({
          company_id: activeCompanyId,
          site_id: activeSiteId,
          title: t,
          type,
          status: "open",
          occurred_at: new Date(occurredAt).toISOString(),
          location: location.trim() || null,
          reported_by: reportedBy.trim() || null,
          description: description.trim() || null,
          immediate_action: immediateAction.trim() || null,
          template_id: template?.id ?? null,
          form_data: formData ?? {},
        })
        .select("id")
        .single();

      if (incErr) throw incErr;
      const incidentId = created.id as string;

      // Create actions
      const actionRows = actions
        .map((a) => ({
          action_text: a.action_text.trim(),
          assigned_role: a.assigned_role,
          due_date: a.due_date || null,
        }))
        .filter((a) => a.action_text.length > 0);

      if (actionRows.length) {
        const { error: actErr } = await supabase.from("incident_actions").insert(
          actionRows.map((a) => ({
            company_id: activeCompanyId,
            site_id: activeSiteId,
            incident_id: incidentId,
            action_text: a.action_text,
            assigned_role: a.assigned_role,
            due_date: a.due_date,
            status: "open",
          }))
        );
        if (actErr) throw actErr;
      }

      // Upload attachments
      if (files.length) {
        setUploading(true);

        for (const f of files) {
          const safeName = f.name.replace(/[^\w.\-() ]+/g, "_");
          const path = `company/${activeCompanyId}/site/${activeSiteId}/incidents/${incidentId}/${Date.now()}_${safeName}`;

          const { error: upErr } = await supabase.storage.from("compliance").upload(path, f, {
            upsert: false,
            contentType: f.type || undefined,
          });
          if (upErr) throw upErr;

          const { error: metaErr } = await supabase.from("form_attachments").insert({
            company_id: activeCompanyId,
            site_id: activeSiteId,
            incident_id: incidentId,
            path,
            filename: f.name,
            mime_type: f.type || null,
          });
          if (metaErr) throw metaErr;
        }
      }

      // go to detail page
      nav(`/app/incidents/${incidentId}`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to save incident");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  const schemaSections = (template?.schema?.sections ?? []) as any[];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New incident</h1>
          <p className="text-muted-foreground">Log it properly, attach evidence, and assign actions.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/app/incidents")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      ) : null}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>Basic incident information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Type</div>
              <Select value={type} onValueChange={(v) => setType(v as IncidentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="near_miss">Near miss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                Occurred at <span className="text-red-600">*</span>
              </div>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              Title <span className="text-red-600">*</span>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Slip in kitchen, glass breakage, delivery issue…"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Location (optional)</div>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kitchen / Bar / Store room" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Reported by (optional)</div>
              <Input value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} placeholder="Name" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Description (optional)</div>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Immediate action taken (optional)</div>
            <Textarea value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} placeholder="e.g. Area cordoned off, first aid given, cleaned, retraining booked…" />
          </div>
        </CardContent>
      </Card>

      {/* Template selection + dynamic fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template</CardTitle>
          <CardDescription>
            Legally approved templates are provided by Safyra. Your company can create an editable version.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTemplates ? (
            <div className="text-sm text-muted-foreground">Loading templates…</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No templates found for this type. (Check RLS and that legal templates are seeded.)
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Select template</div>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({templateKindLabel(t, activeCompanyId ?? null)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                {template ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={template.company_id === null && template.is_legally_approved ? "secondary" : "outline"}>
                      {templateKindLabel(template, activeCompanyId ?? null)}
                    </Badge>
                    <div className="text-sm text-muted-foreground truncate">{template.name}</div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {template && schemaSections.length ? (
            <div className="space-y-4">
              {schemaSections.map((sec: any, idx: number) => (
                <div key={`${sec.title ?? "section"}-${idx}`} className="rounded-lg border p-4 space-y-4">
                  <div>
                    <div className="font-semibold">{sec.title}</div>
                    {sec.description ? <div className="text-sm text-muted-foreground">{sec.description}</div> : null}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(sec.fields ?? []).map((f: any) => {
                      // 🔥 Conditional visibility
if (f.show_if) {
  const currentValue = formData?.[f.show_if.key];
  if (currentValue !== f.show_if.equals) {
    return null;
  }
}
                      const v = formData?.[f.key];

                      if (f.type === "yesno") {
                        const value = v === true ? "yes" : v === false ? "no" : "";
                        return (
                          <div key={f.key} className="space-y-2">
                            <div className="text-sm font-medium">
                              {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                            </div>
                            <Select value={value} onValueChange={(x) => setField(f.key, x === "yes" ? true : x === "no" ? false : null)}>
                              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            {f.help ? <div className="text-xs text-muted-foreground">{f.help}</div> : null}
                          </div>
                        );
                      }

                      if (f.type === "textarea") {
                        return (
                          <div key={f.key} className="space-y-2 md:col-span-2">
                            <div className="text-sm font-medium">
                              {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                            </div>
                            <Textarea
                              value={String(v ?? "")}
                              onChange={(e) => setField(f.key, e.target.value)}
                              placeholder={f.placeholder ?? ""}
                            />
                            {f.help ? <div className="text-xs text-muted-foreground">{f.help}</div> : null}
                          </div>
                        );
                      }

                      if (f.type === "body_map") {
                        return (
                          <div key={f.key} className="md:col-span-2">
                            <BodyMapField
                              label={f.label}
                              value={typeof v === "string" ? v : null}
                              onChange={(x) => setField(f.key, x)}
                              regions={Array.isArray(f.regions) ? f.regions : []}
                            />
                          </div>
                        );
                      }

                      if (f.type === "select" || f.type === "radio") {
                        const options = Array.isArray(f.options) ? f.options : [];
                        return (
                          <div key={f.key} className="space-y-2">
                            <div className="text-sm font-medium">
                              {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                            </div>
                            <Select value={String(v ?? "")} onValueChange={(x) => setField(f.key, x)}>
                              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                              <SelectContent>
                                {options.map((o: any) => (
                                  <SelectItem key={o.value} value={String(o.value)}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }

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
                            value={v ?? ""}
                            onChange={(e) => setField(f.key, inputType === "number" ? Number(e.target.value) : e.target.value)}
                            placeholder={f.placeholder ?? ""}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Action plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action plan</CardTitle>
          <CardDescription>Assign corrective actions with due dates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((a, idx) => (
            <div key={idx} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Action {idx + 1}</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActions((p) => p.filter((_, i) => i !== idx))}
                  disabled={actions.length === 1}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
              </div>

              <Textarea
                value={a.action_text}
                onChange={(e) => setActions((p) => p.map((x, i) => (i === idx ? { ...x, action_text: e.target.value } : x)))}
                placeholder="What needs doing?"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Assigned to</div>
                  <Select
                    value={a.assigned_role}
                    onValueChange={(v) =>
                      setActions((p) => p.map((x, i) => (i === idx ? { ...x, assigned_role: v as AssigneeRole } : x)))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSIGNEE_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Due date</div>
                  <Input
                    type="date"
                    value={a.due_date}
                    onChange={(e) => setActions((p) => p.map((x, i) => (i === idx ? { ...x, due_date: e.target.value } : x)))}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => setActions((p) => [...p, { action_text: "", assigned_role: "restaurant_manager", due_date: "" }])}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add another action
          </Button>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attachments</CardTitle>
          <CardDescription>Upload photos, witness statements, reports, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <Input type="file" multiple onChange={(e) => onFilesPicked(e.target.files)} />
            <Button type="button" variant="outline" disabled={!files.length} className="gap-2 md:w-auto">
              <Upload className="w-4 h-4" />
              {files.length ? `${files.length} file(s) selected` : "No files"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Files upload automatically when you click Save.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}