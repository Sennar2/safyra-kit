// src/lib/incidents.ts
import { supabase } from "@/integrations/supabase/client";

export type IncidentType = "incident" | "accident" | "near_miss";
export type IncidentStatus = "open" | "closed";

export type IncidentRow = {
  id: string;
  company_id: string;
  site_id: string;
  type: IncidentType;
  title: string;
  occurred_at: string;
  location: string | null;
  reported_by: string | null;
  description: string | null;
  immediate_action: string | null;
  status: IncidentStatus;
  created_at: string;
};

export type IncidentActionRow = {
  id: string;
  incident_id: string;
  company_id: string;
  site_id: string;
  action_text: string;
  assigned_role: string | null;
  due_date: string | null;
  status: "open" | "done";
  completed_at: string | null;
  completed_notes: string | null;
  created_at: string;
};

export async function listIncidents(companyId: string, siteId: string, limit = 50) {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

export async function getIncident(id: string) {
  const { data, error } = await supabase.from("incidents").select("*").eq("id", id).single();
  if (error) throw error;
  return data as IncidentRow;
}

export async function listIncidentActions(incidentId: string) {
  const { data, error } = await supabase
    .from("incident_actions")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IncidentActionRow[];
}

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
  const { error } = await supabase
    .from("incident_actions")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_notes: notes,
      completed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .eq("id", actionId);

  if (error) throw error;
}