// src/lib/supplierDeliveries.ts
import { supabase } from "@/integrations/supabase/client";

export type SupplierDeliveryStatus = "received" | "partial" | "rejected" | "quarantined";

export type SupplierDeliveryRow = {
  id: string;
  company_id: string;
  site_id: string | null;
  supplier_id: string;

  delivered_at: string;
  status: SupplierDeliveryStatus;
  notes: string | null;

  invoice_number: string | null;
  invoice_total: number | null;

  invoice_file_path: string | null;
  invoice_mime_type: string | null;

  created_at: string;
  updated_at: string;

  supplier?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
};

export type SupplierDeliveryItemRow = {
  id: string;
  company_id: string;
  delivery_id: string;
  supplier_product_id: string | null;

  item_name: string | null;
  qty: number | null;
  unit: string | null;
  line_notes: string | null;

  created_at: string;

  product?: { id: string; name: string } | null;
};

export async function listSupplierDeliveries(companyId: string, supplierId?: string | null, limit = 50) {
  let q = supabase
    .from("supplier_deliveries")
    .select(
      `
      id,company_id,site_id,supplier_id,delivered_at,status,notes,
      invoice_number,invoice_total,invoice_file_path,invoice_mime_type,
      created_at,updated_at,
      supplier:suppliers(id,name),
      site:sites(id,name)
    `
    )
    .eq("company_id", companyId)
    .order("delivered_at", { ascending: false })
    .limit(limit);

  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SupplierDeliveryRow[];
}

export async function createSupplierDelivery(
  companyId: string,
  input: {
    supplier_id: string;
    site_id?: string | null;
    delivered_at?: string | null; // ISO
    status?: SupplierDeliveryStatus;
    notes?: string | null;
    invoice_number?: string | null;
    invoice_total?: number | null;
    invoice_file_path?: string | null;
    invoice_mime_type?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("supplier_deliveries")
    .insert({
      company_id: companyId,
      supplier_id: input.supplier_id,
      site_id: input.site_id ?? null,
      delivered_at: input.delivered_at ?? new Date().toISOString(),
      status: input.status ?? "received",
      notes: input.notes ?? null,
      invoice_number: input.invoice_number ?? null,
      invoice_total: input.invoice_total ?? null,
      invoice_file_path: input.invoice_file_path ?? null,
      invoice_mime_type: input.invoice_mime_type ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(
      `
      id,company_id,site_id,supplier_id,delivered_at,status,notes,
      invoice_number,invoice_total,invoice_file_path,invoice_mime_type,
      created_at,updated_at,
      supplier:suppliers(id,name),
      site:sites(id,name)
    `
    )
    .single();

  if (error) throw error;
  return data as SupplierDeliveryRow;
}

export async function listDeliveryItems(companyId: string, deliveryId: string) {
  const { data, error } = await supabase
    .from("supplier_delivery_items")
    .select(
      `
      id,company_id,delivery_id,supplier_product_id,
      item_name,qty,unit,line_notes,created_at,
      product:supplier_products(id,name)
    `
    )
    .eq("company_id", companyId)
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupplierDeliveryItemRow[];
}

export async function addDeliveryItem(
  companyId: string,
  input: {
    delivery_id: string;
    supplier_product_id?: string | null;
    item_name?: string | null;
    qty?: number | null;
    unit?: string | null;
    line_notes?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("supplier_delivery_items")
    .insert({
      company_id: companyId,
      delivery_id: input.delivery_id,
      supplier_product_id: input.supplier_product_id ?? null,
      item_name: input.item_name ?? null,
      qty: input.qty ?? null,
      unit: input.unit ?? null,
      line_notes: input.line_notes ?? null,
    })
    .select(
      `
      id,company_id,delivery_id,supplier_product_id,
      item_name,qty,unit,line_notes,created_at,
      product:supplier_products(id,name)
    `
    )
    .single();

  if (error) throw error;
  return data as SupplierDeliveryItemRow;
}

export async function deleteDeliveryItem(id: string) {
  const { error } = await supabase.from("supplier_delivery_items").delete().eq("id", id);
  if (error) throw error;
}