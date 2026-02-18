import { supabase } from "@/integrations/supabase/client";

export type SiteRow = {
  id: string;
  name: string;
  company_id: string;
  status?: string | null;
  created_at?: string;
};

export type ChecklistTemplateRow = {
  id: string;
  company_id: string;
  name: string;
  type: "opening" | "closing" | "custom" | string;
  created_at?: string;
  updated_at?: string;
};

export type ChecklistTemplateItemRow = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  is_required: boolean;
  photo_required: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ChecklistRunRow = {
  id: string;
  company_id: string;
  site_id: string;
  template_id: string | null;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  template_name?: string | null;
  site_name?: string | null;
};

export type ChecklistRunItemRow = {
  id: string;
  entry_id: string;
  template_item_id: string;
  status: "pending" | "done" | "na" | string;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;

  // joined (read-only helpers)
  title?: string | null;
  description?: string | null;
  is_required?: boolean | null;
  photo_required?: boolean | null;
  sort_order?: number | null;
};

export async function listSites(companyId: string) {
  const { data, error } = await supabase
    .from("sites")
    .select("id,name,company_id,status,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SiteRow[];
}

/**
 * TEMPLATES
 */
export async function listChecklistTemplates(companyId: string) {
  const { data, error } = await supabase
    .from("check_templates")
    .select("id,company_id,name,type,created_at,updated_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChecklistTemplateRow[];
}

export async function createChecklistTemplate(
  companyId: string,
  input: { name: string; type: "opening" | "closing" | "custom" }
) {
  const { data, error } = await supabase
    .from("check_templates")
    .insert({ company_id: companyId, name: input.name, type: input.type })
    .select("id,company_id,name,type,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as ChecklistTemplateRow;
}

export async function updateChecklistTemplate(
  templateId: string,
  patch: Partial<{ name: string; type: string }>
) {
  const { data, error } = await supabase
    .from("check_templates")
    .update(patch)
    .eq("id", templateId)
    .select("id,company_id,name,type,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as ChecklistTemplateRow;
}

export async function deleteChecklistTemplate(templateId: string) {
  const { error } = await supabase.from("check_templates").delete().eq("id", templateId);
  if (error) throw error;
  return true;
}

/**
 * TEMPLATE ITEMS
 */
export async function listTemplateItems(templateId: string) {
  const { data, error } = await supabase
    .from("check_template_items")
    .select("id,template_id,title,description,is_required,photo_required,sort_order,created_at,updated_at")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChecklistTemplateItemRow[];
}

export async function createTemplateItem(
  templateId: string,
  input: {
    title: string;
    description?: string;
    is_required?: boolean;
    photo_required?: boolean;
    sort_order?: number;
  }
) {
  const payload = {
    template_id: templateId,
    title: input.title,
    description: input.description ?? null,
    is_required: input.is_required ?? true,
    photo_required: input.photo_required ?? false,
    sort_order: input.sort_order ?? 0,
  };

  const { data, error } = await supabase
    .from("check_template_items")
    .insert(payload)
    .select("id,template_id,title,description,is_required,photo_required,sort_order,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as ChecklistTemplateItemRow;
}

export async function updateTemplateItem(
  itemId: string,
  patch: Partial<Omit<ChecklistTemplateItemRow, "id" | "template_id">>
) {
  const { data, error } = await supabase
    .from("check_template_items")
    .update(patch)
    .eq("id", itemId)
    .select("id,template_id,title,description,is_required,photo_required,sort_order,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as ChecklistTemplateItemRow;
}

export async function deleteTemplateItem(itemId: string) {
  const { error } = await supabase.from("check_template_items").delete().eq("id", itemId);
  if (error) throw error;
  return true;
}

/**
 * RUNS (check_entries as runs)
 */
export async function startChecklistRun(params: {
  companyId: string;
  siteId: string;
  templateId: string;
  dueAt?: string | null;
}) {
  // get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  // 1) create run
  const { data: run, error: runErr } = await supabase
    .from("check_entries")
    .insert({
      company_id: params.companyId,
      site_id: params.siteId,
      template_id: params.templateId,
      status: "open",
      due_at: params.dueAt ?? null,
      performed_by: user.id, // 🔥 THIS FIXES YOUR ERROR
    })
    .select("id,company_id,site_id,template_id,status,due_at,completed_at,created_at")
    .single();

  if (runErr) throw runErr;


  // 2) fetch template items
  const items = await listTemplateItems(params.templateId);

  // 3) create run items
  if (items.length) {
    const rows = items.map((it) => ({
      entry_id: run.id,
      template_item_id: it.id,
      status: "pending",
    }));

    const { error: itemsErr } = await supabase.from("check_entry_items").insert(rows);
    if (itemsErr) throw itemsErr;
  }

  return run as ChecklistRunRow;
}

export async function listRuns(params: { companyId: string; siteId: string; limit?: number }) {
  const { data, error } = await supabase
    .from("check_entries")
    .select("id,company_id,site_id,template_id,status,due_at,completed_at,created_at, check_templates(name)")
    .eq("company_id", params.companyId)
    .eq("site_id", params.siteId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 25);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    company_id: r.company_id,
    site_id: r.site_id,
    template_id: r.template_id ?? null,
    status: r.status ?? "open",
    due_at: r.due_at ?? null,
    completed_at: r.completed_at ?? null,
    created_at: r.created_at,
    template_name: r.check_templates?.name ?? null,
  })) as ChecklistRunRow[];
}

/**
 * RUN EXECUTION
 */
export async function getRun(runId: string) {
  const { data, error } = await supabase
    .from("check_entries")
    .select("id,company_id,site_id,template_id,status,due_at,completed_at,created_at, check_templates(name), sites(name)")
    .eq("id", runId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    company_id: data.company_id,
    site_id: data.site_id,
    template_id: data.template_id ?? null,
    status: data.status ?? "open",
    due_at: data.due_at ?? null,
    completed_at: data.completed_at ?? null,
    created_at: data.created_at,
    template_name: (data as any).check_templates?.name ?? null,
    site_name: (data as any).sites?.name ?? null,
  } as ChecklistRunRow;
}

export async function listRunItems(runId: string) {
  const { data, error } = await supabase
    .from("check_entry_items")
    .select(
      `
      id,entry_id,template_item_id,status,notes,completed_at,completed_by,created_at,
      check_template_items:check_template_items(title,description,is_required,photo_required,sort_order)
    `
    )
    .eq("entry_id", runId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    entry_id: row.entry_id,
    template_item_id: row.template_item_id,
    status: row.status,
    notes: row.notes ?? null,
    completed_at: row.completed_at ?? null,
    completed_by: row.completed_by ?? null,
    created_at: row.created_at,
    title: row.check_template_items?.title ?? null,
    description: row.check_template_items?.description ?? null,
    is_required: row.check_template_items?.is_required ?? null,
    photo_required: row.check_template_items?.photo_required ?? null,
    sort_order: row.check_template_items?.sort_order ?? 0,
  })) as ChecklistRunItemRow[];
}

export async function updateRunItem(params: {
  runItemId: string;
  status?: "pending" | "done" | "na";
  notes?: string | null;
}) {
  const patch: any = {};
  if (params.status) {
    patch.status = params.status;
    if (params.status === "done" || params.status === "na") {
      patch.completed_at = new Date().toISOString();
    } else {
      patch.completed_at = null;
      patch.completed_by = null;
    }
  }
  if (params.notes !== undefined) patch.notes = params.notes;

  const { data, error } = await supabase
    .from("check_entry_items")
    .update(patch)
    .eq("id", params.runItemId)
    .select("id,entry_id,template_item_id,status,notes,completed_at,completed_by,created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function completeRun(runId: string) {
  const { data, error } = await supabase
    .from("check_entries")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select("id,company_id,site_id,template_id,status,due_at,completed_at,created_at")
    .single();

  if (error) throw error;
  return data as ChecklistRunRow;
}

export type RunFilters = {
  companyId: string;
  siteId: string;
  status?: "open" | "completed" | string;
  templateId?: string;
  fromIso?: string; // ISO datetime (inclusive)
  toIso?: string;   // ISO datetime (exclusive)
  limit?: number;
};

/**
 * Filter runs by status/template/date range (uses due_at primarily; falls back to created_at if due_at is null)
 */
export async function listRunsFiltered(filters: RunFilters) {
  const limit = filters.limit ?? 50;

  // We can’t OR-filter (due_at OR created_at) cleanly in PostgREST without a view/RPC,
  // so we filter by created_at in range, and we sort + display due_at if present.
  // If you want strict due_at filtering, we’ll create a view later.
  let q = supabase
    .from("check_entries")
    .select(
      "id,company_id,site_id,template_id,status,due_at,completed_at,created_at, check_templates(name)"
    )
    .eq("company_id", filters.companyId)
    .eq("site_id", filters.siteId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.templateId) q = q.eq("template_id", filters.templateId);

  if (filters.fromIso) q = q.gte("created_at", filters.fromIso);
  if (filters.toIso) q = q.lt("created_at", filters.toIso);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    company_id: r.company_id,
    site_id: r.site_id,
    template_id: r.template_id ?? null,
    status: r.status ?? "open",
    due_at: r.due_at ?? null,
    completed_at: r.completed_at ?? null,
    created_at: r.created_at,
    template_name: r.check_templates?.name ?? null,
  })) as ChecklistRunRow[];
}

/**
 * “Today’s runs”: due_at between start/end of today (local time -> ISO)
 */
export async function listTodaysRuns(params: { companyId: string; siteId: string; limit?: number }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(24, 0, 0, 0);

  const { data, error } = await supabase
    .from("check_entries")
    .select(
      "id,company_id,site_id,template_id,status,due_at,completed_at,created_at, check_templates(name)"
    )
    .eq("company_id", params.companyId)
    .eq("site_id", params.siteId)
    .gte("due_at", start.toISOString())
    .lt("due_at", end.toISOString())
    .order("due_at", { ascending: true })
    .limit(params.limit ?? 50);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    company_id: r.company_id,
    site_id: r.site_id,
    template_id: r.template_id ?? null,
    status: r.status ?? "open",
    due_at: r.due_at ?? null,
    completed_at: r.completed_at ?? null,
    created_at: r.created_at,
    template_name: r.check_templates?.name ?? null,
  })) as ChecklistRunRow[];
}

export type DashboardChecklistSummary = {
  sites: SiteRow[];
  overdue: ChecklistRunRow[];
  dueToday: ChecklistRunRow[];
  completedToday: ChecklistRunRow[];
};

export async function getDashboardChecklistSummary(companyId: string, siteId: string) {
  // 1) Sites for dropdown
  const sites = await listSites(companyId);

  // If caller passed dummy/invalid siteId, fallback to first site (if any)
  const chosenSiteId =
    sites.find((s) => s.id === siteId)?.id ?? sites[0]?.id ?? null;

  if (!chosenSiteId) {
    return {
      sites: [],
      overdue: [],
      dueToday: [],
      completedToday: [],
    } as DashboardChecklistSummary;
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // We fetch runs for this site (recent) then split in memory
  const runs = await listRuns({ companyId, siteId: chosenSiteId, limit: 200 });

  const overdue: ChecklistRunRow[] = [];
  const dueToday: ChecklistRunRow[] = [];
  const completedToday: ChecklistRunRow[] = [];

  for (const r of runs) {
    const status = (r.status ?? "open").toLowerCase();
    const dueAt = r.due_at ? new Date(r.due_at) : null;
    const completedAt = r.completed_at ? new Date(r.completed_at) : null;

    if (status === "completed") {
      if (
        completedAt &&
        completedAt.getTime() >= startOfToday.getTime() &&
        completedAt.getTime() <= endOfToday.getTime()
      ) {
        completedToday.push(r);
      }
      continue;
    }

    // open
    if (dueAt) {
      if (dueAt.getTime() < startOfToday.getTime()) overdue.push(r);
      else if (
        dueAt.getTime() >= startOfToday.getTime() &&
        dueAt.getTime() <= endOfToday.getTime()
      ) {
        dueToday.push(r);
      }
    }
  }

  // sort overdue oldest-first, dueToday soonest-first, completed newest-first
  overdue.sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  dueToday.sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  completedToday.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  return {
    sites,
    overdue,
    dueToday,
    completedToday,
  } as DashboardChecklistSummary;
}
