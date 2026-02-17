import { supabase } from "@/integrations/supabase/client";

export type TempAssetType = "fridge" | "freezer";
export type TempKind = "fridge" | "freezer" | "food" | "delivery";
export type TempExpectationKind = "asset" | "food" | "delivery";

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

  asset?: { id: string; name: string; type: TempAssetType } | null;
  food?: { id: string; name: string } | null;
  probe?: { id: string; name: string } | null;
};

export function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function listSites(companyId: string) {
  const { data, error } = await supabase
    .from("sites")
    .select("id,name,company_id,status,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; company_id: string; status?: string | null }[];
}

/**
 * ASSETS
 */
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

/**
 * PROBES
 */
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

/**
 * FOOD ITEMS
 */
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

/**
 * EXPECTATIONS
 */
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

/**
 * RECORDS
 */
export async function createTempRecord(input: {
  companyId: string;
  siteId: string;
  kind: TempKind;
  valueC: number;
  assetId?: string | null;
  foodItemId?: string | null;
  probeId?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("temp_records")
    .insert({
      company_id: input.companyId,
      site_id: input.siteId,
      kind: input.kind,
      value_c: input.valueC,
      asset_id: input.assetId ?? null,
      food_item_id: input.foodItemId ?? null,
      probe_id: input.probeId ?? null,
      notes: input.notes ?? null,
      recorded_at: new Date().toISOString(),
    })
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,probe_id,value_c,notes,recorded_at,created_at,
      asset:temp_assets(id,name,type),
      food:temp_food_items(id,name),
      probe:temp_probes(id,name)
    `)
    .single();
  if (error) throw error;
  return data as TempRecordRow;
}

export async function listTempRecordsToday(companyId: string, siteId: string, limit = 200) {
  const { data, error } = await supabase
    .from("temp_records")
    .select(`
      id,company_id,site_id,kind,asset_id,food_item_id,probe_id,value_c,notes,recorded_at,created_at,
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

/**
 * TODAY SUMMARY (client-side, fast enough for MVP)
 */
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
        // no record yet = treat as due now (overdue)
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

export async function applyTempDefaults(companyId: string, siteId: string) {
  const { data, error } = await supabase.rpc("apply_temp_defaults", {
    p_company_id: companyId,
    p_site_id: siteId,
  });
  if (error) throw error;
  return data;
}
