import { supabase } from "@/integrations/supabase/client";

export type SupplierStatus = "pending" | "approved" | "blocked";

export type SupplierRow = {
  id: string;
  company_id: string;
  name: string;
  type: string | null;
  status: SupplierStatus;
  active: boolean;
  email: string | null;
  phone: string | null;
  account_ref: string | null;
  created_at: string;
};

export async function listSuppliers(companyId: string) {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,company_id,name,type,status,active,email,phone,account_ref,created_at")
    .eq("company_id", companyId)
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(
  companyId: string,
  input: {
    name: string;
    type?: string | null;
    status?: SupplierStatus;
    email?: string | null;
    phone?: string | null;
    account_ref?: string | null;
  }
) {
  const payload = {
    company_id: companyId,
    name: input.name,
    type: input.type ?? null,
    status: input.status ?? "pending",
    active: true,
    email: input.email ?? null,
    phone: input.phone ?? null,
    account_ref: input.account_ref ?? null,
  };

  const { data, error } = await supabase
    .from("suppliers")
    .insert(payload)
    .select("id,company_id,name,type,status,active,email,phone,account_ref,created_at")
    .single();

  if (error) throw error;
  return data as SupplierRow;
}

export async function setSupplierActive(supplierId: string, active: boolean) {
  const { data, error } = await supabase
    .from("suppliers")
    .update({ active })
    .eq("id", supplierId)
    .select("id,company_id,name,type,status,active,email,phone,account_ref,created_at")
    .single();

  if (error) throw error;
  return data as SupplierRow;
}
