// src/lib/temps.ts
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

  recorded_by?: string | null;

  // delivery fields (DB)
  delivery_item?: string | null;
  supplier?: string | null;
  delivery_result?: string | null;

  // action fields (DB)
  requires_action?: boolean | null;
  action_due_at?: string | null;
  action_logged?: boolean | null;
  action_notes?: string | null; // what needed doing
  action_completed_notes?: string | null; // what was done ✅
  action_logged_at?: string | null;
  action_logged_by?: string | null;

  asset?: { id: string; name: string; type: TempAssetType } | null;
  food?: { id: string; name: string } | null;
  probe?: { id: string; name: string } | null;
};

export type CorrectiveActionPriority = "low" | "medium" | "high" | "critical";

export type CorrectiveActionRow = {
  id: string; // temp_records.id
  company_id: string;
  site_id: string;

  title: string;
  details: string | null; // what needed doing (mapped from action_notes)

  due_at: string | null;
  priority: CorrectiveActionPriority;

  created_at: string;
  recorded_at: string;

  action_logged: boolean;
  action_logged_at: string | null;
  action_notes: string | null; // what needed doing
  action_completed_notes?: string | null; // what was done ✅

  recorded_by: string | null;
  action_logged_by: string | null;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
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
    const standard =
      "Freezers: ≤ -18°C OK, -18 to -15°C warning, > -15°C action";
    if (v <= -18)
      return {
        severity: "ok",
        requiresAction: false,
        message: `OK (${v.toFixed(1)}°C).`,
        standard,
      };
    if (v > -18 && v <= -15)
      return {
        severity: "warn",
        requiresAction: false,
        message: `Warning: ${v.toFixed(1)}°C (monitor, recheck).`,
        standard,
      };
    return {
      severity: "critical",
      requiresAction: true,
      message: `Action required: ${v.toFixed(1)}°C (too warm).`,
      standard,
    };
  }

  if (input.kind === "fridge" || input.kind === "delivery") {
    const standard = "Chilled: ≤ 5°C OK, 5–8°C warning, ≥ 8°C action";
    if (v <= 5)
      return {
        severity: "ok",
        requiresAction: false,
        message: `OK (${v.toFixed(1)}°C).`,
        standard,
      };
    if (v > 5 && v < 8)
      return {
        severity: "warn",
        requiresAction: false,
        message: `Warning: ${v.toFixed(1)}°C (monitor, recheck).`,
        standard,
      };
    return {
      severity: "critical",
      requiresAction: true,
      message: `Action required: ${v.toFixed(1)}°C (too warm).`,
      standard,
    };
  }

  const target = input.foodScotland ? 82 : 75;
  const standard = `Food core temp: ≥ ${target}°C required`;
  if (v >= target)
    return {
      severity: "ok",
      requiresAction: false,
      message: `OK (${v.toFixed(1)}°C).`,
      standard,
    };
  return {
    severity: "critical",
    requiresAction: true,
    message: `Action required: ${v.toFixed(1)}°C (below ${target}°C).`,
    standard,
  };
}

/** =========================
 *  SITES
 *  ========================= */
export async function listSites(companyId: string) {
  const { data, error } = await supabase
    .from("sites")
    .select("id,name,company_id,status,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as {
    id: string;
    name: string;
    company_id: string;
    status?: string | null;
  }[];
}

/** =========================
 *  ASSETS / PROBES / FOODS / EXPECTATIONS
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

export async function listTempProbes(companyId: string) {
  const { data, error } = await supabase
    .from("temp_probes")
    .select(
      "id,company_id,name,serial,active,last_calibrated_at,next_calibration_due_at,created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TempProbeRow[];
}

export async function createTempProbe(
  companyId: string,
  input: { name: string; serial?: string | null }
) {
  const { data, error } = await supabase
    .from("temp_probes")
    .insert({
      company_id: companyId,
      name: input.name,
      serial: input.serial ?? null,
    })
    .select("id,company_id,name,serial,active,last_calibrated_at,next_calibration_due_at,created_at")
    .single();

  if (error) throw error;
  return data as TempProbeRow;
}

export async function listTempFoodItems(companyId: string) {
  const { data, error } = await supabase
    .from("temp_food_items")
    .select("id,company_id,name,category,active,recommended_every_minutes,required,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TempFoodItemRow[];
}

export async function createTempFoodItem(
  companyId: string,
  input: {
    name: string;
    category?: string | null;
    recommended_every_minutes?: number;
    required?: boolean;
  }
) {
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

export async function setTempExpectationActive(
  expectationId: string,
  active: boolean
) {
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

  // delivery fields (DB names)
  deliveryItem?: string | null;
  supplier?: string | null;
  deliveryResult?: DeliveryResult | string | null;

  // action fields (DB names)
  requiresAction?: boolean;
  actionNotes?: string | null; // what needed doing
  actionDueAt?: string | null;
}) {
  const userId = await currentUserId();

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
    recorded_by: userId,

    // delivery
    delivery_item: input.deliveryItem ?? null,
    supplier: input.supplier ?? null,
    delivery_result: input.deliveryResult ?? null,

    // actions
    requires_action: input.requiresAction ?? false,
    action_notes: input.actionNotes ?? null,
    action_due_at: input.actionDueAt ?? null,
    action_logged: false,
    action_logged_at: null,
    action_logged_by: null,
    action_completed_notes: null,
  };

  const { data, error } = await supabase
    .from("temp_records")
    .insert(payload)
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,probe_id,value_c,notes,recorded_at,created_at,
      recorded_by,
      delivery_item,supplier,delivery_result,
      requires_action,action_due_at,action_logged,action_notes,action_completed_notes,action_logged_at,action_logged_by,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name),
      probe:temp_probes(id,name)
    `)
    .single();

  if (error) throw error;
  return data as TempRecordRow;
}

export async function createDeliveryTempRecord(input: {
  companyId: string;
  siteId: string;
  valueC: number;
  probeId?: string | null;
  notes?: string | null;

  itemName: string;
  supplier?: string | null;
  deliveryResult: DeliveryResult;

  requiresAction: boolean;
  actionNotes?: string | null;
  actionDueAt?: string | null;
}) {
  return createTempRecord({
    companyId: input.companyId,
    siteId: input.siteId,
    kind: "delivery",
    valueC: input.valueC,
    probeId: input.probeId ?? null,
    notes: input.notes ?? null,
    deliveryItem: input.itemName,
    supplier: input.supplier ?? null,
    deliveryResult: input.deliveryResult,
    requiresAction: input.requiresAction,
    actionNotes: input.actionNotes ?? null,
    actionDueAt: input.actionDueAt ?? null,
  });
}

export async function listTempRecordsToday(
  companyId: string,
  siteId: string,
  limit = 200
) {
  const { data, error } = await supabase
    .from("temp_records")
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,probe_id,value_c,notes,recorded_at,created_at,
      recorded_by,
      delivery_item,supplier,delivery_result,
      requires_action,action_due_at,action_logged,action_notes,action_completed_notes,action_logged_at,action_logged_by,
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
 *  DASHBOARD ACTIONS (from temp_records)
 *  ========================= */
export async function listOpenCorrectiveActions(
  companyId: string,
  siteId: string,
  limit = 50
) {
  const { data, error } = await supabase
    .from("temp_records")
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,value_c,notes,recorded_at,created_at,
      recorded_by,
      delivery_item,supplier,delivery_result,
      requires_action,action_due_at,action_logged,action_notes,action_completed_notes,action_logged_at,action_logged_by,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name)
    `)
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .eq("requires_action", true)
    .eq("action_logged", false)
    .order("action_due_at", { ascending: true, nullsFirst: false })
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data ?? []) as TempRecordRow[];

  return rows.map((r) => {
    const title =
      r.kind === "food"
        ? `Action required: FOOD • ${r.food?.name ?? "Food"}`
        : r.kind === "fridge" || r.kind === "freezer"
        ? `Action required: ${r.kind.toUpperCase()} • ${r.asset?.name ?? "Asset"}`
        : `Action required: DELIVERY • ${r.delivery_item ?? "Item"}`;

    const details =
      r.action_notes ??
      r.notes ??
      (r.kind === "delivery"
        ? `${r.supplier ? `Supplier: ${r.supplier}. ` : ""}${
            r.delivery_result
              ? `Result: ${String(r.delivery_result).toUpperCase()}.`
              : ""
          }`
        : null);

    return {
      id: r.id,
      company_id: r.company_id,
      site_id: r.site_id,
      title,
      details,
      due_at: r.action_due_at ?? null,
      priority: "medium",
      created_at: r.created_at,
      recorded_at: r.recorded_at,
      action_logged: !!r.action_logged,
      action_logged_at: r.action_logged_at ?? null,
      action_notes: r.action_notes ?? null,
      action_completed_notes: r.action_completed_notes ?? null,
      recorded_by: (r as any).recorded_by ?? null,
      action_logged_by: r.action_logged_by ?? null,
    } as CorrectiveActionRow;
  });
}

export async function listRecentlyCompletedCorrectiveActions(
  companyId: string,
  siteId: string,
  limit = 10
) {
  const { data, error } = await supabase
    .from("temp_records")
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,value_c,notes,recorded_at,created_at,
      recorded_by,
      delivery_item,supplier,delivery_result,
      requires_action,action_due_at,action_logged,action_notes,action_completed_notes,action_logged_at,action_logged_by,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name)
    `)
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .eq("requires_action", true)
    .eq("action_logged", true)
    .order("action_logged_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data ?? []) as TempRecordRow[];

  return rows.map((r) => {
    const title =
      r.kind === "food"
        ? `Completed: FOOD • ${r.food?.name ?? "Food"}`
        : r.kind === "fridge" || r.kind === "freezer"
        ? `Completed: ${r.kind.toUpperCase()} • ${r.asset?.name ?? "Asset"}`
        : `Completed: DELIVERY • ${r.delivery_item ?? "Item"}`;

    const details =
      r.action_notes ??
      r.notes ??
      (r.kind === "delivery"
        ? `${r.supplier ? `Supplier: ${r.supplier}. ` : ""}${
            r.delivery_result
              ? `Result: ${String(r.delivery_result).toUpperCase()}.`
              : ""
          }`
        : null);

    return {
      id: r.id,
      company_id: r.company_id,
      site_id: r.site_id,
      title,
      details,
      due_at: r.action_due_at ?? null,
      priority: "medium",
      created_at: r.created_at,
      recorded_at: r.recorded_at,
      action_logged: true,
      action_logged_at: r.action_logged_at ?? null,
      action_notes: r.action_notes ?? null,
      action_completed_notes: r.action_completed_notes ?? null,
      recorded_by: (r as any).recorded_by ?? null,
      action_logged_by: r.action_logged_by ?? null,
    } as CorrectiveActionRow;
  });
}

export async function completeCorrectiveAction(
  tempRecordId: string,
  completedNotes?: string | null
) {
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("temp_records")
    .update({
      action_logged: true,
      action_logged_at: new Date().toISOString(),
      action_logged_by: userId,
      action_completed_notes: completedNotes ?? null,
    })
    .eq("id", tempRecordId)
    .select(`
      id,company_id,site_id,
      requires_action,action_logged,action_logged_at,action_logged_by,
      action_notes,action_completed_notes,action_due_at
    `)
    .single();

  if (error) throw error;
  return data;
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

export async function getTempTodaySummary(
  companyId: string,
  siteId: string
): Promise<TempTodaySummary> {
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

  const overdue = dueRows.filter(
    (d) => !d.last_recorded_at || (d.due_at && new Date(d.due_at).getTime() < now)
  );
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
