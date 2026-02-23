// src/lib/incidents.ts
import { supabase } from "@/integrations/supabase/client";

// =======================================================
// Incidents
// =======================================================

export type IncidentType = "incident" | "accident" | "near_miss";
export type IncidentStatus = "open" | "closed";

export type IncidentRow = {
  id: string;
  company_id: string;
  site_id: string;

  title: string;
  type: IncidentType;
  status: IncidentStatus;

  occurred_at: string; // required by Incidents.tsx page
  location: string | null;
  reported_by: string | null;
  description: string | null;

  // Templates + dynamic fields (optional)
  template_id?: string | null;
  form_data?: Record<string, any>;

  created_at?: string;
};

export async function listIncidents(companyId: string, siteId: string, limit = 80) {
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, company_id, site_id, title, type, status, occurred_at, location, reported_by, description, template_id, form_data, created_at"
    )
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

export async function getIncident(incidentId: string) {
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, company_id, site_id, title, type, status, occurred_at, location, reported_by, description, template_id, form_data, created_at"
    )
    .eq("id", incidentId)
    .single();

  if (error) throw error;
  return data as IncidentRow;
}

export async function createIncident(input: {
  company_id: string;
  site_id: string;

  title: string;
  type: IncidentType;
  occurred_at: string;

  location?: string | null;
  reported_by?: string | null;
  description?: string | null;

  template_id?: string | null;
  form_data?: Record<string, any>;
}) {
  const payload: any = {
    company_id: input.company_id,
    site_id: input.site_id,

    title: input.title,
    type: input.type,
    status: "open",

    occurred_at: input.occurred_at,
    location: input.location ?? null,
    reported_by: input.reported_by ?? null,
    description: input.description ?? null,

    template_id: input.template_id ?? null,
    form_data: input.form_data ?? {},
  };

  const { data, error } = await supabase.from("incidents").insert(payload).select("*").single();
  if (error) throw error;
  return data as IncidentRow;
}

export async function updateIncident(incidentId: string, patch: Partial<IncidentRow>) {
  // Safelist keys (avoid company_id/site_id/id changes)
  const allowed: any = {};
  if (patch.title !== undefined) allowed.title = patch.title;
  if (patch.type !== undefined) allowed.type = patch.type;
  if (patch.status !== undefined) allowed.status = patch.status;

  if (patch.occurred_at !== undefined) allowed.occurred_at = patch.occurred_at;
  if (patch.location !== undefined) allowed.location = patch.location;
  if (patch.reported_by !== undefined) allowed.reported_by = patch.reported_by;
  if (patch.description !== undefined) allowed.description = patch.description;

  if ((patch as any).template_id !== undefined) allowed.template_id = (patch as any).template_id;
  if ((patch as any).form_data !== undefined) allowed.form_data = (patch as any).form_data;

  const { error } = await supabase.from("incidents").update(allowed).eq("id", incidentId);
  if (error) throw error;
}

// =======================================================
// Incident Templates (Legally Approved + Company Override)
// =======================================================

export type IncidentTemplateKey = IncidentType;

export type IncidentTemplateFieldType =
  | "text"
  | "textarea"
  | "date"
  | "time"
  | "datetime"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "yesno";

export type IncidentTemplateField = {
  key: string; // saved in incidents.form_data[key]
  label: string;
  type: IncidentTemplateFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
};

export type IncidentTemplateSection = {
  title: string;
  description?: string;
  fields: IncidentTemplateField[];
};

export type IncidentTemplateSchema = {
  version: number;
  sections: IncidentTemplateSection[];
};

export type IncidentTemplateRow = {
  id: string;
  company_id: string | null; // null => global legal template
  site_id: string | null;

  template_key: IncidentTemplateKey; // "incident" | "accident" | "near_miss"
  name: string;
  incident_type: IncidentType;

  is_legally_approved: boolean;
  is_active: boolean;

  schema: IncidentTemplateSchema;

  created_at: string;
  updated_at: string;
};

/**
 * Fetch templates visible to the company:
 * - legal: company_id is null
 * - company: company_id = companyId
 *
 * For the same template_key, company override wins.
 */
export async function listIncidentTemplates(companyId: string, incidentType?: IncidentType) {
  let q = supabase
    .from("incident_templates")
    .select("*")
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .eq("is_active", true);

  if (incidentType) q = q.eq("incident_type", incidentType);

  const { data, error } = await q.order("is_legally_approved", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as IncidentTemplateRow[];

  // Choose company version over global legal version per template_key
  const map = new Map<string, IncidentTemplateRow>();
  for (const t of rows) {
    const key = t.template_key;

    if (!map.has(key)) {
      map.set(key, t);
      continue;
    }

    const existing = map.get(key)!;
    const existingIsCompany = existing.company_id === companyId;
    const currentIsCompany = t.company_id === companyId;

    if (!existingIsCompany && currentIsCompany) {
      map.set(key, t);
    }
  }

  return Array.from(map.values());
}

export async function getIncidentTemplateById(templateId: string) {
  const { data, error } = await supabase
    .from("incident_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) throw error;
  return data as IncidentTemplateRow;
}

/**
 * Company can create/update their own editable copy (override).
 * Do NOT update legal template rows (company_id null).
 */
export async function upsertCompanyIncidentTemplate(input: {
  company_id: string;
  site_id?: string | null;
  template_key: IncidentTemplateKey;
  name: string;
  incident_type: IncidentType;
  schema: IncidentTemplateSchema;
  is_active?: boolean;
}) {
  const payload: any = {
    company_id: input.company_id,
    site_id: input.site_id ?? null,

    template_key: input.template_key,
    name: input.name,
    incident_type: input.incident_type,

    schema: input.schema,
    is_active: input.is_active ?? true,

    is_legally_approved: false,
  };

  const { data, error } = await supabase
    .from("incident_templates")
    .upsert(payload, { onConflict: "company_id,template_key" })
    .select("*")
    .single();

  if (error) throw error;
  return data as IncidentTemplateRow;
}

// =======================================================
// Incident Actions (Detail page + Dashboard depend on these)
// =======================================================

export type IncidentActionRow = {
  id: string;
  company_id: string;
  site_id: string;
  incident_id: string;

  action_text: string;
  due_date: string | null; // date-only
  status: "open" | "completed" | "cancelled";

  assigned_role: string | null;

  action_completed_notes: string | null;
  action_completed_at: string | null;

  created_at: string;
};

export async function listOpenIncidentActions(companyId: string, siteId: string, limit = 50) {
  const { data, error } = await supabase
    .from("incident_actions")
    .select("*")
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .eq("status", "open")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as IncidentActionRow[];
}

/** Used by IncidentDetail.tsx */
export async function listIncidentActions(incidentId: string) {
  const { data, error } = await supabase
    .from("incident_actions")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IncidentActionRow[];
}

/** Optional helper (commonly used in detail page) */
export async function createIncidentAction(input: {
  company_id: string;
  site_id: string;
  incident_id: string;
  action_text: string;
  due_date?: string | null; // date-only
  assigned_role?: string | null;
}) {
  const payload: any = {
    company_id: input.company_id,
    site_id: input.site_id,
    incident_id: input.incident_id,
    action_text: input.action_text,
    due_date: input.due_date ?? null,
    assigned_role: input.assigned_role ?? null,
    status: "open",
  };

  const { data, error } = await supabase
    .from("incident_actions")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as IncidentActionRow;
}

export async function completeIncidentAction(actionId: string, notes: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const { error } = await supabase
    .from("incident_actions")
    .update({
      status: "completed",
      action_completed_notes: notes,
      action_completed_at: new Date().toISOString(),
      action_completed_by: userId,
    })
    .eq("id", actionId);

  if (error) throw error;
}

export async function cancelIncidentAction(actionId: string, notes?: string) {
  const { error } = await supabase
    .from("incident_actions")
    .update({
      status: "cancelled",
      action_completed_notes: notes ?? null,
      action_completed_at: new Date().toISOString(),
    })
    .eq("id", actionId);

  if (error) throw error;
}