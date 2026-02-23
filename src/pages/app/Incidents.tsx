// src/lib/incidents.ts
import { supabase } from "@/integrations/supabase/client";

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

  created_at?: string;
};

export async function listIncidents(companyId: string, siteId: string, limit = 80) {
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, company_id, site_id, title, type, status, occurred_at, location, reported_by, description, created_at"
    )
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

// =======================================================
// Incident Actions (Dashboard depends on these)
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