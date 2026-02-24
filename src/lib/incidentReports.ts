import { supabase } from "@/integrations/supabase/client";
import type { IncidentType } from "@/lib/incidents";

export type IncidentReportRow = {
  id: string;
  company_id: string;
  site_id: string;

  type: IncidentType;
  status: "open" | "closed";
  title: string;
  occurred_at: string;

  location: string | null;
  reported_by: string | null;

  description: string | null;
  immediate_action: string | null;

  template_id: string | null;
  template_name: string | null;
  template_version: number | null;
  template_is_legal: boolean | null;
  template_snapshot: any | null;
  form_data: Record<string, any> | null;

  created_at: string;

  actions: any[];
  attachments: any[];
};

export async function listIncidentReports(params: {
  companyId: string;
  siteId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  type?: IncidentType | "all";
  status?: "open" | "closed" | "all";
  limit?: number;
}) {
  const {
    companyId,
    siteId,
    dateFrom,
    dateTo,
    type = "all",
    status = "all",
    limit = 200,
  } = params;

  let q = supabase
    .from("incident_report_v")
    .select("*")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (siteId) q = q.eq("site_id", siteId);

  // occurred_at is timestamptz; filter by ISO boundaries
  if (dateFrom) q = q.gte("occurred_at", new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
  if (dateTo) q = q.lte("occurred_at", new Date(`${dateTo}T23:59:59.999Z`).toISOString());

  if (type !== "all") q = q.eq("type", type);
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as IncidentReportRow[];
}