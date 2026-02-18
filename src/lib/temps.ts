import { supabase } from "@/integrations/supabase/client";

export type TempAssetType = "fridge" | "freezer";
export type TempKind = "fridge" | "freezer" | "food" | "delivery";
export type TempExpectationKind = "asset" | "food" | "delivery";

export type DeliveryResult = "ok" | "reject" | "quarantine";

export type TempAssetRow = {
  id: string;
  company_id: string;
  site_id: string;
  type: TempAssetType;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type TempProbeRow = {
  id: string;
  company_id: string;
  name: string;
  serial: string | null;
  active: boolean;
  last_calibrated_at: string | null;
  next_calibration_due_at: string | null;
  created_at: string;
};

export type TempFoodItemRow = {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  active: boolean;
  recommended_every_minutes: number;
  required: boolean;
  created_at: string;
};

export type TempExpectationRow = {
  id: string;
  company_id: string;
  site_id: string;
  kind: TempExpectationKind;
  asset_id: string | null;
  food_item_id: string | null;
  every_minutes: number;
  active: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;

  asset?: { id: string; name: string; type: TempAssetType } | null;
  food?: { id: string; name: string } | null;
};

export type TempRecordRow = {
  id: string;
  company_id: string;
  site_id: string;
  kind: TempKind;
  asset_id: string | null;
  food_item_id: string | null;
  probe_id: string | null;
  value_c: number;
  notes: string | null;
  recorded_at: string;
  created_at: string;

  // Delivery metadata (optional columns)
  delivery_item_name?: string | null;
  delivery_supplier?: string | null;
  delivery_batch?: string | null;
  delivery_result?: string | null;

  // Corrective action metadata (optional columns)
  corrective_action_required?: boolean | null;
  corrective_action?: string | null;
  corrective_priority?: string | null;
  corrective_due_at?: string | null;

  asset?: { id: string; name: string; type: TempAssetType } | null;
  food?: { id: string; name: string } | null;
  probe?: { id: string; name: string } | null;
};

export type CorrectiveActionPriority = "low" | "medium" | "high" | "critical";
export type CorrectiveActionStatus = "open" | "completed" | "cancelled";

export type CorrectiveActionRow = {
  id: string;
  company_id: string;
  site_id: string;

  source: string;
  source_id: string | null;

  title: string;
  details: string | null;

  priority: CorrectiveActionPriority | string;
  due_at: string | null;

  status: CorrectiveActionStatus | string;
  created_at: string;
  created_by: string | null;

  completed_at: string | null;
  completed_by: string | null;
};

/** Helpers */
export function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** =========================
 *  EVALUATION
 *  ========================= */
export type TempEvaluation = {
  severity: "ok" | "warn" | "critical";
  requiresAction: boolean;
  message: string;
  standard: string;
};

export function evaluateTemp(
  input:
    | { kind: "fridge"; valueC: number }
    | { kind: "freezer"; valueC: number }
    | { kind: "delivery"; valueC: number }
    | { kind: "food"; valueC: number; foodScotland?: boolean }
): TempEvaluation {
  const v = input.valueC;

  if (input.kind === "freezer") {
    const standard = "Freezers: ≤ -18°C OK, -18 to -15°C warning, > -15°C action";
    if (v <= -18) return { severity: "ok", requiresAction: false, message: `OK (${v.toFixed(1)}°C).`, standard };
    if (v > -18 && v <= -15) return { severity: "warn", requiresAction: false, message: `Warning: ${v.toFixed(1)}°C (monitor, recheck).`, standard };
    return { severity: "critical", requiresAction: true, message: `Action required: ${v.toFixed(1)}°C (too warm).`, standard };
  }

  if (input.kind === "fridge" || input.kind === "delivery") {
    const standard = "Chilled: ≤ 5°C OK, 5–8°C warning, ≥ 8°C action";
    if (v <= 5) return { severity: "ok", requiresAction: false, message: `OK (${v.toFixed(1)}°C).`, standard };
    if (v > 5 && v < 8) return { severity: "warn", requiresAction: false, message: `Warning: ${v.toFixed(1)}°C (monitor, recheck).`, standard };
    return { severity: "critical", requiresAction: true, message: `Action required: ${v.toFixed(1)}°C (too warm).`, standard };
  }

  // food
  const target = input.foodScotland ? 82 : 75;
  const standard = `Food core temp: ≥ ${target}°C required`;
  if (v >= target) return { severity: "ok", requiresAction: false, message: `OK (${v.toFixed(1)}°C).`, standard };
  return { severity: "critical", requiresAction: true, message: `Action required: ${v.toFixed(1)}°C (below ${target}°C).`, standard };
}

/** =========================
 *  SITES
 *  ========================= */
export async function listSites(companyId: string) {
  const { data, error } = await supabase
    .from("sites")
    // If "status" doesn't exist in your DB, remove it from select.
    .select("id,name,company_id,status,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as { id: string; name: string; company_id: string; status?: string | null }[];
}

/** =========================
 *  ASSETS
 *  ========================= */
export async function listTempAssets(companyId: string, siteId: string) {
  const { data, error } = await supabase
    .from("temp_assets")
    .select("id,company_id,site_id,type,name,active,sort_order,created_at")
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TempAssetRow[];
}

export async function createTempAsset(input: {
  companyId: string;
  siteId: string;
  type: TempAssetType;
  name: string;
  sort_order?: number;
}) {
  const { data, error } = await supabase
    .from("temp_assets")
    .insert({
      company_id: input.companyId,
      site_id: input.siteId,
      type: input.type,
      name: input.name,
      sort_order: input.sort_order ?? 0,
    })
    .select("id,company_id,site_id,type,name,active,sort_order,created_at")
    .single();

  if (error) throw error;
  return data as TempAssetRow;
}

export async function setTempAssetActive(assetId: string, active: boolean) {
  const { data, error } = await supabase
    .from("temp_assets")
    .update({ active })
    .eq("id", assetId)
    .select("id,company_id,site_id,type,name,active,sort_order,created_at")
    .single();

  if (error) throw error;
  return data as TempAssetRow;
}

/** =========================
 *  PROBES
 *  ========================= */
export async function listTempProbes(companyId: string) {
  const { data, error } = await supabase
    .from("temp_probes")
    .select("id,company_id,name,serial,active,last_calibrated_at,next_calibration_due_at,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TempProbeRow[];
}

export async function createTempProbe(companyId: string, input: { name: string; serial?: string | null }) {
  const { data, error } = await supabase
    .from("temp_probes")
    .insert({ company_id: companyId, name: input.name, serial: input.serial ?? null })
    .select("id,company_id,name,serial,active,last_calibrated_at,next_calibration_due_at,created_at")
    .single();

  if (error) throw error;
  return data as TempProbeRow;
}

/** =========================
 *  FOOD ITEMS
 *  ========================= */
export async function listTempFoodItems(companyId: string) {
  const { data, error } = await supabase
    .from("temp_food_items")
    .select("id,company_id,name,category,active,recommended_every_minutes,required,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TempFoodItemRow[];
}

export async function createTempFoodItem(companyId: string, input: {
  name: string;
  category?: string | null;
  recommended_every_minutes?: number;
  required?: boolean;
}) {
  const { data, error } = await supabase
    .from("temp_food_items")
    .insert({
      company_id: companyId,
      name: input.name,
      category: input.category ?? null,
      recommended_every_minutes: input.recommended_every_minutes ?? 120,
      required: input.required ?? false,
    })
    .select("id,company_id,name,category,active,recommended_every_minutes,required,created_at")
    .single();

  if (error) throw error;
  return data as TempFoodItemRow;
}

/** =========================
 *  EXPECTATIONS
 *  ========================= */
export async function listTempExpectations(companyId: string, siteId: string) {
  const { data, error } = await supabase
    .from("temp_expectations")
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,every_minutes,active,start_time,end_time,created_at,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name)
    `)
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TempExpectationRow[];
}

export async function createTempExpectation(input: {
  companyId: string;
  siteId: string;
  kind: TempExpectationKind;
  assetId?: string | null;
  foodItemId?: string | null;
  everyMinutes: number;
}) {
  const { data, error } = await supabase
    .from("temp_expectations")
    .insert({
      company_id: input.companyId,
      site_id: input.siteId,
      kind: input.kind,
      asset_id: input.assetId ?? null,
      food_item_id: input.foodItemId ?? null,
      every_minutes: input.everyMinutes,
      active: true,
    })
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,every_minutes,active,start_time,end_time,created_at,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name)
    `)
    .single();

  if (error) throw error;
  return data as TempExpectationRow;
}

export async function setTempExpectationActive(expectationId: string, active: boolean) {
  const { data, error } = await supabase
    .from("temp_expectations")
    .update({ active })
    .eq("id", expectationId)
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,every_minutes,active,start_time,end_time,created_at,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name)
    `)
    .single();

  if (error) throw error;
  return data as TempExpectationRow;
}

/** =========================
 *  CORRECTIVE ACTIONS (TASKS)
 *  ========================= */
export async function createCorrectiveAction(input: {
  companyId: string;
  siteId: string;
  title: string;
  details?: string | null;
  priority?: CorrectiveActionPriority;
  dueAt?: string | null;
  source?: string;
  sourceId?: string | null;
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

  const { data, error } = await supabase
    .from("corrective_actions")
    .insert({
      company_id: input.companyId,
      site_id: input.siteId,
      source: input.source ?? "temp_record",
      source_id: input.sourceId ?? null,
      title: input.title,
      details: input.details ?? null,
      priority: input.priority ?? "medium",
      due_at: input.dueAt ?? null,
      status: "open",
      created_by: userId,
    })
    .select("id,company_id,site_id,source,source_id,title,details,priority,due_at,status,created_at,created_by,completed_at,completed_by")
    .single();

  if (error) throw error;
  return data as CorrectiveActionRow;
}

export async function listOpenCorrectiveActions(companyId: string, siteId: string, limit = 50) {
  const { data, error } = await supabase
    .from("corrective_actions")
    .select("id,company_id,site_id,source,source_id,title,details,priority,due_at,status,created_at,created_by,completed_at,completed_by")
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as CorrectiveActionRow[];
}

export async function completeCorrectiveAction(actionId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

  const { data, error } = await supabase
    .from("corrective_actions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq("id", actionId)
    .select("id,company_id,site_id,source,source_id,title,details,priority,due_at,status,created_at,created_by,completed_at,completed_by")
    .single();

  if (error) throw error;
  return data as CorrectiveActionRow;
}

/** =========================
 *  RECORDS
 *  ========================= */
export async function createTempRecord(input: {
  companyId: string;
  siteId: string;
  kind: TempKind;
  valueC: number;
  assetId?: string | null;
  foodItemId?: string | null;
  probeId?: string | null;
  notes?: string | null;

  // delivery meta (optional)
  deliveryItemName?: string | null;
  deliverySupplier?: string | null;
  deliveryBatch?: string | null;
  deliveryResult?: string | null;

  // corrective meta (optional)
  correctiveActionRequired?: boolean;
  correctiveAction?: string | null;
  correctivePriority?: string | null;
  correctiveDueAt?: string | null;
}) {
  const payload: any = {
    company_id: input.companyId,
    site_id: input.siteId,
    kind: input.kind,
    value_c: input.valueC,
    asset_id: input.assetId ?? null,
    food_item_id: input.foodItemId ?? null,
    probe_id: input.probeId ?? null,
    notes: input.notes ?? null,
    recorded_at: new Date().toISOString(),

    delivery_item_name: input.deliveryItemName ?? null,
    delivery_supplier: input.deliverySupplier ?? null,
    delivery_batch: input.deliveryBatch ?? null,
    delivery_result: input.deliveryResult ?? null,

    corrective_action_required: input.correctiveActionRequired ?? false,
    corrective_action: input.correctiveAction ?? null,
    corrective_priority: input.correctivePriority ?? null,
    corrective_due_at: input.correctiveDueAt ?? null,
  };

  const { data, error } = await supabase
    .from("temp_records")
    .insert(payload)
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,probe_id,value_c,notes,recorded_at,created_at,
      delivery_item_name,delivery_supplier,delivery_batch,delivery_result,
      corrective_action_required,corrective_action,corrective_priority,corrective_due_at,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name),
      probe:temp_probes(id,name)
    `)
    .single();

  if (error) throw error;
  return data as TempRecordRow;
}

/**
 * Delivery-specific creator:
 * - always writes temp_records row
 * - if action required => also writes corrective_actions task
 */
export async function createDeliveryTempRecord(input: {
  companyId: string;
  siteId: string;
  valueC: number;

  probeId?: string | null;
  notes?: string | null;

  itemName: string;
  supplier?: string | null;
  batch?: string | null;
  deliveryResult: DeliveryResult;

  correctiveAction?: string | null;
  correctivePriority?: CorrectiveActionPriority;
  correctiveDueAt?: string | null;
}) {
  const evalRes = evaluateTemp({ kind: "delivery", valueC: input.valueC });
  const requiresAction = evalRes.requiresAction || input.deliveryResult !== "ok";

  const record = await createTempRecord({
    companyId: input.companyId,
    siteId: input.siteId,
    kind: "delivery",
    valueC: input.valueC,
    probeId: input.probeId ?? null,
    notes: input.notes ?? null,
    deliveryItemName: input.itemName,
    deliverySupplier: input.supplier ?? null,
    deliveryBatch: input.batch ?? null,
    deliveryResult: input.deliveryResult,
    correctiveActionRequired: requiresAction,
    correctiveAction: requiresAction ? (input.correctiveAction ?? null) : null,
    correctivePriority: requiresAction ? (input.correctivePriority ?? "medium") : null,
    correctiveDueAt: requiresAction ? (input.correctiveDueAt ?? null) : null,
  });

  if (requiresAction) {
    await createCorrectiveAction({
      companyId: input.companyId,
      siteId: input.siteId,
      source: "temp_record",
      sourceId: record.id,
      title: `Delivery temp action: ${input.itemName}`,
      details:
        `Result: ${input.deliveryResult.toUpperCase()}\n` +
        `Temp: ${input.valueC.toFixed(1)}°C\n` +
        `${input.supplier ? `Supplier: ${input.supplier}\n` : ""}` +
        `${input.batch ? `Batch/Lot: ${input.batch}\n` : ""}` +
        `${input.correctiveAction ? `Corrective: ${input.correctiveAction}` : "Corrective: (not provided)"}`,
      priority: input.correctivePriority ?? "medium",
      dueAt: input.correctiveDueAt ?? null,
    });
  }

  return record;
}

export async function listTempRecordsToday(companyId: string, siteId: string, limit = 200) {
  const { data, error } = await supabase
    .from("temp_records")
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,probe_id,value_c,notes,recorded_at,created_at,
      delivery_item_name,delivery_supplier,delivery_batch,delivery_result,
      corrective_action_required,corrective_action,corrective_priority,corrective_due_at,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name),
      probe:temp_probes(id,name)
    `)
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .gte("recorded_at", startOfTodayISO())
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TempRecordRow[];
}

/** =========================
 *  TODAY SUMMARY
 *  ========================= */
export type TempDueRow = {
  key: string;
  label: string;
  kind: TempExpectationKind;
  every_minutes: number;
  last_recorded_at: string | null;
  due_at: string | null;
  minutes_overdue: number | null;
};

export type TempTodaySummary = {
  sites: { id: string; name: string; company_id: string; status?: string | null }[];
  expectations: TempExpectationRow[];
  recordsToday: TempRecordRow[];
  overdue: TempDueRow[];
  dueSoon: TempDueRow[];
};

export async function getTempTodaySummary(companyId: string, siteId: string): Promise<TempTodaySummary> {
  const [sites, expectations, recordsToday] = await Promise.all([
    listSites(companyId),
    listTempExpectations(companyId, siteId),
    listTempRecordsToday(companyId, siteId, 500),
  ]);

  const now = Date.now();

  const lastByKey = new Map<string, TempRecordRow>();
  for (const r of recordsToday) {
    const key =
      r.kind === "food"
        ? `food:${r.food_item_id}`
        : r.kind === "fridge" || r.kind === "freezer"
        ? `asset:${r.asset_id}`
        : `delivery`;
    if (!key) continue;
    if (!lastByKey.has(key)) lastByKey.set(key, r);
  }

  const dueRows: TempDueRow[] = expectations
    .filter((e) => e.active)
    .map((e) => {
      const key =
        e.kind === "food"
          ? `food:${e.food_item_id}`
          : e.kind === "asset"
          ? `asset:${e.asset_id}`
          : `delivery`;

      const last = lastByKey.get(key) ?? null;
      const lastAt = last?.recorded_at ?? null;

      let dueAt: string | null = null;
      let minutesOverdue: number | null = null;

      if (lastAt) {
        const dueMs = new Date(lastAt).getTime() + e.every_minutes * 60_000;
        dueAt = new Date(dueMs).toISOString();
        const diffMin = Math.floor((now - dueMs) / 60_000);
        minutesOverdue = diffMin > 0 ? diffMin : 0;
      } else {
        dueAt = null;
        minutesOverdue = null;
      }

      const label =
        e.kind === "asset"
          ? `${e.asset?.type?.toUpperCase() ?? "ASSET"} • ${e.asset?.name ?? "Asset"}`
          : e.kind === "food"
          ? `FOOD • ${e.food?.name ?? "Food item"}`
          : "DELIVERY • Delivery temp";

      return {
        key,
        label,
        kind: e.kind,
        every_minutes: e.every_minutes,
        last_recorded_at: lastAt,
        due_at: dueAt,
        minutes_overdue: lastAt ? minutesOverdue : null,
      };
    });

  const overdue = dueRows.filter((d) => !d.last_recorded_at || (d.due_at && new Date(d.due_at).getTime() < now));
  const dueSoon = dueRows
    .filter((d) => d.last_recorded_at && d.due_at && new Date(d.due_at).getTime() >= now)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, 20);

  return { sites, expectations, recordsToday, overdue, dueSoon };
}

/** Optional: apply defaults RPC */
export async function applyTempDefaults(companyId: string, siteId: string) {
  const { data, error } = await supabase.rpc("apply_temp_defaults", {
    p_company_id: companyId,
    p_site_id: siteId,
  });
  if (error) throw error;
  return data;
}
