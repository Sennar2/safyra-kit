import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPES = [
  { value: "incident", label: "Incident" },
  { value: "accident", label: "Accident" },
  { value: "near_miss", label: "Near miss" },
] as const;

const ASSIGNEE_ROLES = [
  { value: "head_office", label: "Head Office" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "head_chef", label: "Head Chef" },
  { value: "restaurant_manager", label: "Restaurant Manager" },
] as const;

type IncidentType = (typeof TYPES)[number]["value"];
type AssigneeRole = (typeof ASSIGNEE_ROLES)[number]["value"];

type ActionDraft = {
  id: string;
  action_text: string;
  assigned_role: AssigneeRole | null;
  due_date: string | null;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function IncidentNew() {
  const nav = useNavigate();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<IncidentType>("incident");
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(""); // datetime-local
  const [location, setLocation] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [description, setDescription] = useState("");
  const [immediateAction, setImmediateAction] = useState("");

  const [actions, setActions] = useState<ActionDraft[]>([
    { id: uid(), action_text: "", assigned_role: "restaurant_manager", due_date: null },
  ]);

  const [files, setFiles] = useState<File[]>([]);

  const canSave = useMemo(() => {
    return !!activeCompanyId && !!activeSiteId && !!title.trim() && !!occurredAt;
  }, [activeCompanyId, activeSiteId, title, occurredAt]);

  function addActionRow() {
    setActions((prev) => [...prev, { id: uid(), action_text: "", assigned_role: "restaurant_manager", due_date: null }]);
  }
  function removeActionRow(id: string) {
    setActions((prev) => (prev.length === 1 ? prev : prev.filter((a) => a.id !== id)));
  }
  function updateAction(id: string, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function onFilesPicked(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function uploadFiles(companyId: string, siteId: string, incidentId: string) {
    if (!files.length) return;

    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `company/${companyId}/site/${siteId}/incidents/${incidentId}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage.from("compliance").upload(path, f, {
        upsert: false,
        contentType: f.type || undefined,
      });
      if (upErr) throw upErr;

      const { error: metaErr } = await supabase.from("form_attachments").insert({
        company_id: companyId,
        site_id: siteId,
        incident_id: incidentId,
        path,
        filename: f.name,
        mime_type: f.type || null,
      });
      if (metaErr) throw metaErr;
    }
  }

  async function save() {
    if (!activeCompanyId || !activeSiteId) return;
    if (!title.trim() || !occurredAt) return;

    setSaving(true);
    try {
      const occurredISO = new Date(occurredAt).toISOString();

      const { data: incident, error: incErr } = await supabase
        .from("incidents")
        .insert({
          company_id: activeCompanyId,
          site_id: activeSiteId,
          type,
          title: title.trim(),
          occurred_at: occurredISO,
          location: location.trim() || null,
          reported_by: reportedBy.trim() || null,
          description: description.trim() || null,
          immediate_action: immediateAction.trim() || null,
          status: "open",
        })
        .select("id")
        .single();

      if (incErr) throw incErr;
      const incidentId = incident.id as string;

      const toInsert = actions
        .filter((a) => a.action_text.trim().length > 0)
        .map((a) => ({
          incident_id: incidentId,
          company_id: activeCompanyId,
          site_id: activeSiteId,
          action_text: a.action_text.trim(),
          assigned_role: a.assigned_role,
          due_date: a.due_date,
          status: "open",
        }));

      if (toInsert.length) {
        const { error: actErr } = await supabase.from("incident_actions").insert(toInsert);
        if (actErr) throw actErr;
      }

      await uploadFiles(activeCompanyId, activeSiteId, incidentId);

      // ✅ go back to register
      nav("/app/incidents");
    } catch (e) {
      console.error("Incident save error:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New incident</h1>
          <p className="text-muted-foreground">Log it properly, attach evidence, and assign actions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/app/incidents")}>Back</Button>
          <Button onClick={save} disabled={!canSave || saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as IncidentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Occurred at <span className="text-red-500">*</span></label>
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Slip in kitchen, glass breakage, delivery issue…" />
          </div>

          <div>
            <label className="text-sm font-medium">Location (optional)</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kitchen / Bar / Store room" />
          </div>

          <div>
            <label className="text-sm font-medium">Reported by (optional)</label>
            <Input value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} placeholder="Name" />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Immediate action taken (optional)</label>
            <Textarea value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} placeholder="e.g. Area cordoned off, first aid given, cleaned, retraining booked…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Action plan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {actions.map((a, idx) => (
            <div key={a.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Action {idx + 1}</div>
                <Button variant="outline" onClick={() => removeActionRow(a.id)} disabled={actions.length === 1}>Remove</Button>
              </div>

              <Textarea
                value={a.action_text}
                onChange={(e) => updateAction(a.id, { action_text: e.target.value })}
                placeholder="What needs doing?"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigned to</label>
                  <Select
                    value={a.assigned_role ?? "__none__"}
                    onValueChange={(v) =>
                      updateAction(a.id, { assigned_role: v === "__none__" ? null : (v as AssigneeRole) })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {ASSIGNEE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Due date</label>
                  <Input type="date" value={a.due_date ?? ""} onChange={(e) => updateAction(a.id, { due_date: e.target.value || null })} />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button variant="outline" onClick={addActionRow}>Add action</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload evidence</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" multiple onChange={(e) => onFilesPicked(e.target.files)} />
          {files.length ? <div className="text-sm text-muted-foreground">{files.length} file(s) selected</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}