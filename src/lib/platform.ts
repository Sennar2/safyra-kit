import { supabase } from "@/integrations/supabase/client";

/**
 * Companies
 */
export async function listCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,status,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCompanies error:", error);
    throw error;
  }
  return data ?? [];
}

export async function listMyCompanies() {
  // companies a user is assigned to via company_users
  const { data, error } = await supabase
    .from("company_users")
    .select("company_id, role, companies:companies(id,name,status,created_at)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listMyCompanies error:", error);
    throw error;
  }

  const rows = data ?? [];
  return rows
    .map((r: any) => r.companies)
    .filter(Boolean)
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      created_at: c.created_at,
    }));
}

export async function getCompany(companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,status,created_at")
    .eq("id", companyId)
    .single();

  if (error) {
    console.error("getCompany error:", error);
    throw error;
  }
  return data;
}

export async function createCompany(input: { name: string }) {
  const payload = { name: input.name, status: "active" };

  const { data, error } = await supabase
    .from("companies")
    .insert(payload)
    .select("id,name,status,created_at")
    .single();

  if (error) {
    console.error("createCompany error:", error);
    throw error;
  }
  return data;
}

export async function setCompanyStatus(companyId: string, status: "active" | "inactive") {
  const { data, error } = await supabase
    .from("companies")
    .update({ status })
    .eq("id", companyId)
    .select("id,name,status,created_at")
    .single();

  if (error) {
    console.error("setCompanyStatus error:", error);
    throw error;
  }
  return data;
}

/**
 * Company Users
 */
export async function listCompanyUsers(companyId: string) {
  const { data, error } = await supabase
    .from("company_users")
    .select("id,company_id,user_id,role,created_at, profiles:profiles(email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCompanyUsers error:", error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    email: row.profiles?.email ?? null,
  }));
}

export async function addCompanyUser(
  companyId: string,
  input: { email: string; password: string; role: "owner" | "manager" | "staff" }
) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      email: input.email,
      password: input.password,
      company_id: companyId,
      role: input.role,
    },
  });

  if (error) {
    console.error("addCompanyUser error:", error);
    throw error;
  }
  return data;
}

export async function removeCompanyUser(companyUserId: string) {
  const { error } = await supabase.from("company_users").delete().eq("id", companyUserId);
  if (error) {
    console.error("removeCompanyUser error:", error);
    throw error;
  }
  return true;
}
