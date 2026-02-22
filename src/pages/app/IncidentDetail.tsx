import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";
import {
  getIncident,
  listIncidentActions,
  completeIncidentAction,
  type IncidentActionRow,
  type IncidentRow,
} from "@/lib/incidents";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft, Paperclip, CheckCircle2, AlertTriangle, Upload } from "lucide-react";

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
  // due_date is date-only, treat as end of day
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

export default function IncidentDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState<IncidentRow | null>(null);
  const [actions, setActions] = useState<IncidentActionRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // complete notes per action
  const [completeNotes, setCompleteNotes] = useState<Record<string, string>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);

  // add new action inline
  const [newActionText, setNewActionText] = useState("");
  const [newActionRole, setNewActionRole] = useState<AssigneeRole>("restaurant_manager");
  const [newActionDue, setNewActionDue] = useState<string>("");

  // upload
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const openActions = useMemo(() => actions.filter((a) => a.status === "open"), [actions]);
  const doneActions = useMemo(() => actions.filter((a) => a.status === "done"), [actions]);

  const load = async () => {
    if (!id) return;
    setErr(null);
    setLoading(true);
    try {
      const [inc, acts] = await Promise.all([getIncident(id), listIncidentActions(id)]);
      setIncident(inc);
      setActions(acts);

      // attachments
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

        const { error: upErr } = await supabase.storage.from("compliance").upload(path, f, {
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
    const { data, error } = await supabase.storage.from("compliance").createSignedUrl(path, 60);
    if (error) {
      setErr(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold truncate">{incident.title}</h1>
            {typeBadge(incident.type)}
            <Badge variant={incident.status === "open" ? "secondary" : "outline"}>{incident.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Occurred: {formatDateTime(incident.occurred_at)}
            {incident.location ? ` • ${incident.location}` : ""}
            {incident.reported_by ? ` • Reported by ${incident.reported_by}` : ""}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/app/incidents")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
          <CardDescription>What happened and what was done immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Details</div>
            <div className="mt-1 whitespace-pre-line">{incident.description || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Immediate action</div>
            <div className="mt-1 whitespace-pre-line">{incident.immediate_action || "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>Assign tasks and complete them with notes (inspection-ready).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add action */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="font-medium">Add action</div>
            <Textarea
              value={newActionText}
              onChange={(e) => setNewActionText(e.target.value)}
              placeholder="e.g. Replace broken tile, retrain staff on manual handling, update risk assessment…"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Assigned to</div>
                <Select value={newActionRole} onValueChange={(v) => setNewActionRole(v as AssigneeRole)}>
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
                <Input type="date" value={newActionDue} onChange={(e) => setNewActionDue(e.target.value)} />
              </div>
              <div className="flex items-end justify-end">
                <Button onClick={addAction} disabled={!newActionText.trim()} className="w-full md:w-auto">
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Open actions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <div className="font-medium">Open</div>
              <Badge variant={openActions.length ? "destructive" : "secondary"}>{openActions.length}</Badge>
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
                      <Badge variant={overdue ? "destructive" : "secondary"}>{overdue ? "overdue" : "open"}</Badge>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Completion notes (required)</div>
                      <Input
                        className="mt-2"
                        value={completeNotes[a.id] ?? ""}
                        onChange={(e) =>
                          setCompleteNotes((p) => ({ ...p, [a.id]: e.target.value }))
                        }
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

          {/* Done actions */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <div className="font-medium">Completed</div>
              <Badge variant="secondary">{doneActions.length}</Badge>
            </div>

            {doneActions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed actions yet.</div>
            ) : (
              doneActions.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold whitespace-pre-line">{a.action_text}</div>
                    <Badge variant="secondary">done</Badge>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="text-xs text-muted-foreground">What was done</div>
                    <div className="mt-1 whitespace-pre-line">{a.completed_notes || "—"}</div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Completed: {formatDateTime(a.completed_at)} • Original due: {a.due_date ?? "—"}
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
            <Button
              onClick={uploadFiles}
              disabled={!files.length || uploading}
              className="gap-2 md:w-auto"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {files.length ? (
            <div className="text-sm text-muted-foreground">{files.length} file(s) selected</div>
          ) : null}

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