// src/pages/app/EhoVisitNew.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RATING = ["0", "1", "2", "3", "4", "5"] as const;

const ASSIGNEE_ROLES = [
  { value: "head_office", label: "Head Office" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "head_chef", label: "Head Chef" },
  { value: "restaurant_manager", label: "Restaurant Manager" },
] as const;

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

export default function EhoVisitNew() {
  const nav = useNavigate();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [saving, setSaving] = useState(false);

  // Visit fields (required: officerName, visitDate, visitTime)
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [officerName, setOfficerName] = useState("");

  const [councilName, setCouncilName] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");
  const [officerPhone, setOfficerPhone] = useState("");

  const [overallRating, setOverallRating] = useState<string>("");

  const [foodRating, setFoodRating] = useState<string>("");
  const [foodComment, setFoodComment] = useState("");

  const [structureRating, setStructureRating] = useState<string>("");
  const [structureComment, setStructureComment] = useState("");

  const [managementRating, setManagementRating] = useState<string>("");
  const [managementComment, setManagementComment] = useState("");

  const [notes, setNotes] = useState("");

  // Actions (default assignee: Restaurant Manager)
  const [actions, setActions] = useState<ActionDraft[]>([
    { id: uid(), action_text: "", assigned_role: "restaurant_manager", due_date: null },
  ]);

  // Upload
  const [files, setFiles] = useState<File[]>([]);

  const canSave = useMemo(() => {
    return (
      !!activeCompanyId &&
      !!activeSiteId &&
      !!visitDate &&
      !!visitTime &&
      !!officerName.trim()
    );
  }, [activeCompanyId, activeSiteId, visitDate, visitTime, officerName]);

  function addActionRow() {
    setActions((prev) => [
      ...prev,
      { id: uid(), action_text: "", assigned_role: "restaurant_manager", due_date: null },
    ]);
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

  async function uploadFiles(companyId: string, siteId: string, visitId: string) {
    if (!files.length) return;

    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `company/${companyId}/site/${siteId}/eho/${visitId}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage.from("compliance").upload(path, f, {
        upsert: false,
        contentType: f.type || undefined,
      });
      if (upErr) throw upErr;

      const { error: metaErr } = await supabase.from("form_attachments").insert({
        company_id: companyId,
        site_id: siteId,
        eho_visit_id: visitId,
        path,
        filename: f.name,
        mime_type: f.type || null,
      });
      if (metaErr) throw metaErr;
    }
  }

  async function save() {
    if (!activeCompanyId || !activeSiteId) return;
    if (!visitDate || !visitTime || !officerName.trim()) return;

    setSaving(true);
    try {
      // 1) Create visit
      const { data: visit, error: visitErr } = await supabase
        .from("eho_visits")
        .insert({
          company_id: activeCompanyId,
          site_id: activeSiteId,
          visit_date: visitDate,
          visit_time: visitTime,
          officer_name: officerName.trim(), // REQUIRED
          council_name: councilName.trim() || null,
          officer_email: officerEmail.trim() || null,
          officer_phone: officerPhone.trim() || null,
          overall_rating: overallRating ? Number(overallRating) : null,
          status: "open",
          notes: notes || null,
        })
        .select("id")
        .single();

      if (visitErr) throw visitErr;
      const visitId = visit.id as string;

      // 2) Insert sections
      const sections = [
        { section_key: "food_handling", rating: foodRating ? Number(foodRating) : null, comment: foodComment || null },
        { section_key: "structure_cleaning", rating: structureRating ? Number(structureRating) : null, comment: structureComment || null },
        { section_key: "management_confidence", rating: managementRating ? Number(managementRating) : null, comment: managementComment || null },
      ];

      const { error: secErr } = await supabase
        .from("eho_visit_sections")
        .insert(sections.map((s) => ({ visit_id: visitId, ...s })));

      if (secErr) throw secErr;

      // 3) Insert actions (only non-empty)
      const toInsert = actions
        .filter((a) => a.action_text.trim().length > 0)
        .map((a) => ({
          visit_id: visitId,
          action_text: a.action_text.trim(),
          assigned_role: a.assigned_role,
          due_date: a.due_date,
          status: "open",
        }));

      if (toInsert.length) {
        const { error: actErr } = await supabase.from("eho_visit_actions").insert(toInsert);
        if (actErr) throw actErr;
      }

      // 4) Upload files + store metadata
      await uploadFiles(activeCompanyId, activeSiteId, visitId);

      nav(`/app/eho/;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New EHO Visit</h1>
          <p className="text-muted-foreground">
            Record inspection ratings, comments, upload the official report, and create an action plan.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/app/eho")}>
            Back
          </Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save visit"}
          </Button>
        </div>
      </div>

      {/* Visit details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visit details</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">
              Council (optional)
            </label>
            <Input
              value={councilName}
              onChange={(e) => setCouncilName(e.target.value)}
              placeholder="e.g. Wandsworth Council"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Officer name <span className="text-red-500">*</span>
            </label>
            <Input
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              placeholder="Officer full name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Visit date <span className="text-red-500">*</span>
            </label>
            <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium">
              Visit time <span className="text-red-500">*</span>
            </label>
            <Input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium">Officer phone (optional)</label>
            <Input
              value={officerPhone}
              onChange={(e) => setOfficerPhone(e.target.value)}
              placeholder="e.g. 0207…"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Officer email (optional)</label>
            <Input
              type="email"
              value={officerEmail}
              onChange={(e) => setOfficerEmail(e.target.value)}
              placeholder="name@council.gov.uk"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Overall rating (0–5)</label>
            <Select value={overallRating} onValueChange={setOverallRating}>
              <SelectTrigger>
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                {RATING.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Section ratings */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hygienic food handling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={foodRating} onValueChange={setFoodRating}>
              <SelectTrigger>
                <SelectValue placeholder="Rating (0–5)" />
              </SelectTrigger>
              <SelectContent>
                {RATING.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Comment" value={foodComment} onChange={(e) => setFoodComment(e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Structure & cleaning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={structureRating} onValueChange={setStructureRating}>
              <SelectTrigger>
                <SelectValue placeholder="Rating (0–5)" />
              </SelectTrigger>
              <SelectContent>
                {RATING.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Comment"
              value={structureComment}
              onChange={(e) => setStructureComment(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confidence in management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={managementRating} onValueChange={setManagementRating}>
              <SelectTrigger>
                <SelectValue placeholder="Rating (0–5)" />
              </SelectTrigger>
              <SelectContent>
                {RATING.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Comment"
              value={managementComment}
              onChange={(e) => setManagementComment(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Action plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((a, idx) => (
            <div key={a.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Action {idx + 1}</div>
                <Button variant="outline" onClick={() => removeActionRow(a.id)} disabled={actions.length === 1}>
                  Remove
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Textarea
                  value={a.action_text}
                  onChange={(e) => updateAction(a.id, { action_text: e.target.value })}
                  placeholder="e.g. Deep clean behind fridges, replace broken seal, retrain staff on allergens…"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigned to</label>
                  <Select
                    value={a.assigned_role ?? "__none__"}
                    onValueChange={(v) =>
                      updateAction(a.id, {
                        assigned_role: v === "__none__" ? null : (v as AssigneeRole),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {ASSIGNEE_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Due date</label>
                  <Input
                    type="date"
                    value={a.due_date ?? ""}
                    onChange={(e) => updateAction(a.id, { due_date: e.target.value || null })}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button variant="outline" onClick={addActionRow}>
              Add action
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload EHO report / evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" multiple onChange={(e) => onFilesPicked(e.target.files)} />
          {files.length > 0 && <div className="text-sm text-muted-foreground">{files.length} file(s) selected</div>}
          <div className="text-sm text-muted-foreground">
            Tip: Upload the official EHO report PDF + any improvement notices + photos.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}