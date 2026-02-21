// src/lib/supplierProducts.ts
import { supabase } from "@/integrations/supabase/client";

export type SupplierProductRow = {
  id: string;
  company_id: string;
  supplier_id: string;

  name: string;
  sku: string | null;
  category: string | null;

  allergens: string | null;
  spec_notes: string | null;

  approved: boolean;

  requires_temp_check: boolean;
  storage_temp_min_c: number | null;
  storage_temp_max_c: number | null;

  active: boolean;

  created_at: string;
  updated_at: string;

  supplier?: { id: string; name: string } | null;
};

export async function listSupplierProducts(companyId: string, supplierId?: string | null) {
  let q = supabase
    .from("supplier_products")
    .select(
      `
      id,company_id,supplier_id,
      name,sku,category,allergens,spec_notes,
      approved,requires_temp_check,storage_temp_min_c,storage_temp_max_c,
      active,created_at,updated_at,
      supplier:suppliers(id,name)
    `
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SupplierProductRow[];
}

export async function createSupplierProduct(
  companyId: string,
  input: {
    supplier_id: string;
    name: string;
    sku?: string | null;
    category?: string | null;
    allergens?: string | null;
    spec_notes?: string | null;
    approved?: boolean;
    requires_temp_check?: boolean;
    storage_temp_min_c?: number | null;
    storage_temp_max_c?: number | null;
    active?: boolean;
  }
) {
  const { data, error } = await supabase
    .from("supplier_products")
    .insert({
      company_id: companyId,
      supplier_id: input.supplier_id,
      name: input.name,
      sku: input.sku ?? null,
      category: input.category ?? null,
      allergens: input.allergens ?? null,
      spec_notes: input.spec_notes ?? null,
      approved: input.approved ?? false,
      requires_temp_check: input.requires_temp_check ?? false,
      storage_temp_min_c: input.storage_temp_min_c ?? null,
      storage_temp_max_c: input.storage_temp_max_c ?? null,
      active: input.active ?? true,
    })
    .select(
      `
      id,company_id,supplier_id,
      name,sku,category,allergens,spec_notes,
      approved,requires_temp_check,storage_temp_min_c,storage_temp_max_c,
      active,created_at,updated_at,
      supplier:suppliers(id,name)
    `
    )
    .single();

  if (error) throw error;
  return data as SupplierProductRow;
}

export async function updateSupplierProduct(
  id: string,
  patch: Partial<Pick<
    SupplierProductRow,
    | "name"
    | "sku"
    | "category"
    | "allergens"
    | "spec_notes"
    | "approved"
    | "requires_temp_check"
    | "storage_temp_min_c"
    | "storage_temp_max_c"
    | "active"
  >>
) {
  const { data, error } = await supabase
    .from("supplier_products")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      `
      id,company_id,supplier_id,
      name,sku,category,allergens,spec_notes,
      approved,requires_temp_check,storage_temp_min_c,storage_temp_max_c,
      active,created_at,updated_at,
      supplier:suppliers(id,name)
    `
    )
    .single();

  if (error) throw error;
  return data as SupplierProductRow;
}

export async function deleteSupplierProduct(id: string) {
  const { error } = await supabase.from("supplier_products").delete().eq("id", id);
  if (error) throw error;
}