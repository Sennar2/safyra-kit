import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Visit = {
  id: string;
  company_id: string;
  site_id: string;
  visit_date: string;
  officer_name: string | null;
  overall_rating: number | null;
  status: "open" | "actions_in_progress" | "closed";
  notes: string | null;
};

type Section = {
  id: string;
  visit_id: string;
  section_key: "food_handling" | "structure_cleaning" | "management_confidence";
  rating: number | null;
  comment: string | null;
};

type ActionRow = {
  id: string;
  visit_id: string;
  action_text: string;
  assigned_to: string | null;
  due_date: string | null;
  status: "open" | "done" | "overdue";
  completed_at: string | null;
};

type Attachment = {
  id: string;
  path: string;
  filename: string;
  mime_type: string | null;
  created_at: string;
};

const RATING = ["0", "1", "2", "3", "4", "5"] as const;

export default function EhoVisitDetail() {
  const nav = useNavigate();
  const { visitId } = useParams();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [visit, setVisit] = useState<Visit | null>(null);
  const [sections, setSections] = useState<Record<string, Section>>({});
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const canLoad = useMemo(() => !!visitId && !!activeCompanyId && !!activeSiteId, [visitId, activeCompanyId, activeSiteId]);

  async function load() {
    if (!canLoad) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: v, error: vErr } = await supabase
      .from("eho_visits")
      .select("*")
      .eq("id", visitId)
      .single();

    if (vErr) {
      setVisit(null);
      setLoading(false);
      return;
    }

    setVisit(v as Visit);

    const { data: sec } = await supabase
      .from("eho_visit_sections")
      .select("*")
      .eq("visit_id", visitId);

    const map: Record<string, Section> = {};
    for (const s of (sec ?? []) as any[]) map[s.section_key] = s as Section;
    setSections(map);

    const { data: act } = await supabase
      .from("eho_visit_actions")
      .select("*")
      .eq("visit_id", visitId)
      .order("due_date", { ascending: true, nullsFirst: true });

    setActions((act ?? []) as any);

    const { data: att } = await supabase
      .from("form_attachments")
      .select("id, path, filename, mime_type, created_at")
      .eq("eho_visit_id", visitId)
      .order("created_at", { ascending: false });

    setAttachments((att ?? []) as any);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, visitId]);

  function setVisitPatch(p: Partial<Visit>) {
    setVisit((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function setSectionPatch(key: Section["section_key"], p: Partial<Section>) {
    setSections((prev) => ({ ...prev, [key]: { ...(prev[key] as Section), ...p } }));
  }

  async function saveAll() {
    if (!visit) return;
    setSaving(true);
    try {
      const { error: vErr } = await supabase
        .from("eho_visits")
        .update({
          visit_date: visit.visit_date,
          officer_name: visit.officer_name,
          overall_rating: visit.overall_rating,
          status: visit.status,
          notes: visit.notes,
        })
        .eq("id", visit.id);

      if (vErr) throw vErr;

      for (const key of ["food_handling", "structure_cleaning", "management_confidence"] as const) {
        const s = sections[key];
        if (!s) continue;
        const { error: sErr } = await supabase
          .from("eho_visit_sections")
          .update({
            rating: s.rating,
            comment: s.comment,
          })
          .eq("id", s.id);
        if (sErr) throw sErr;
      }

      await uploadNewFiles();

      await load();
    } finally {
      setSaving(false);
    }
  }

  async function uploadNewFiles() {
    if (!visit || !newFiles.length) return;

    for (const f of newFiles) {
      const safeName = f.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `company/${visit.company_id}/site/${visit.site_id}/eho/${visit.id}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage.from("compliance").upload(path, f, {
        upsert: false,
        contentType: f.type || undefined,
      });
      if (upErr) throw upErr;

      const { error: metaErr } = await supabase.from("form_attachments").insert({
        company_id: visit.company_id,
        site_id: visit.site_id,
        eho_visit_id: visit.id,
        path,
        filename: f.name,
        mime_type: f.type || null,
      });
      if (metaErr) throw metaErr;
    }

    setNewFiles([]);
  }

  async function toggleActionDone(a: ActionRow) {
    const nextStatus = a.status === "done" ? "open" : "done";
    await supabase
      .from("eho_visit_actions")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", a.id);

    await load();
  }

  async function addAction() {
    if (!visit) return;
    await supabase.from("eho_visit_actions").insert({
      visit_id: visit.id,
      action_text: "New action",
      status: "open",
    });
    await load();
  }

  async function deleteAction(id: string) {
    await supabase.from("eho_visit_actions").delete().eq("id", id);
    await load();
  }

  async function openAttachment(a: Attachment) {
    const { data, error } = await supabase.storage.from("compliance").createSignedUrl(a.path, 60 * 10);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!visit) return <div className="p-6">Visit not found.</div>;

  const food = sections["food_handling"];
  const structure = sections["structure_cleaning"];
  const mgmt = sections["management_confidence"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">EHO Visit</h1>
          <p className="text-muted-foreground">Edit ratings, manage actions, and store all inspection evidence.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/app/eho")}>Back</Button>
          <Button onClick={saveAll} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Visit details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Visit date</label>
            <Input type="date" value={visit.visit_date} onChange={(e) => setVisitPatch({ visit_date: e.target.value })} />
          </div>

          <div>
            <label className="text-sm font-medium">Officer name</label>
            <Input value={visit.officer_name ?? ""} onChange={(e) => setVisitPatch({ officer_name: e.target.value || null })} />
          </div>

          <div>
            <label className="text-sm font-medium">Overall rating</label>
            <Select
              value={visit.overall_rating === null ? "__none__" : String(visit.overall_rating)}
              onValueChange={(v) => setVisitPatch({ overall_rating: v === "__none__" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="Select rating" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {RATING.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Status</label>
            <Select value={visit.status} onValueChange={(v: any) => setVisitPatch({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="actions_in_progress">Actions in progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={visit.notes ?? ""} onChange={(e) => setVisitPatch({ notes: e.target.value || null })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Hygienic food handling</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={food?.rating === null || food?.rating === undefined ? "__none__" : String(food.rating)}
              onValueChange={(v) => setSectionPatch("food_handling", { rating: v === "__none__" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="Rating (0–5)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {RATING.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Comment"
              value={food?.comment ?? ""}
              onChange={(e) => setSectionPatch("food_handling", { comment: e.target.value || null })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Structure & cleaning</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={structure?.rating === null || structure?.rating === undefined ? "__none__" : String(structure.rating)}
              onValueChange={(v) => setSectionPatch("structure_cleaning", { rating: v === "__none__" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="Rating (0–5)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {RATING.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Comment"
              value={structure?.comment ?? ""}
              onChange={(e) => setSectionPatch("structure_cleaning", { comment: e.target.value || null })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Confidence in management</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={mgmt?.rating === null || mgmt?.rating === undefined ? "__none__" : String(mgmt.rating)}
              onValueChange={(v) => setSectionPatch("management_confidence", { rating: v === "__none__" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="Rating (0–5)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {RATING.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Comment"
              value={mgmt?.comment ?? ""}
              onChange={(e) => setSectionPatch("management_confidence", { comment: e.target.value || null })}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Actions</CardTitle>
          <Button variant="outline" onClick={addAction}>Add action</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.length === 0 ? (
            <div className="text-muted-foreground">No actions yet.</div>
          ) : (
            actions.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{a.action_text}</div>
                    <div className="text-sm text-muted-foreground">
                      Status: {a.status}
                      {a.due_date ? ` • Due: ${a.due_date}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => toggleActionDone(a)}>
                      {a.status === "done" ? "Reopen" : "Mark done"}
                    </Button>
                    <Button variant="outline" onClick={() => deleteAction(a.id)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Files</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" multiple onChange={(e) => setNewFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
          {newFiles.length > 0 && (
            <div className="text-sm text-muted-foreground">{newFiles.length} file(s) queued — click “Save changes” to upload</div>
          )}

          {attachments.length === 0 ? (
            <div className="text-muted-foreground">No files uploaded yet.</div>
          ) : (
            <div className="space-y-2">
              {attachments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openAttachment(a)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition"
                >
                  <div className="font-medium">{a.filename}</div>
                  <div className="text-sm text-muted-foreground">
                    Uploaded {new Date(a.created_at).toLocaleString()}
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