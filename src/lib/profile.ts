import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "manager" | "staff";

export type Profile = {
  id: string;
  company_id: string | null;
  site_id: string | null;
  role: UserRole;
  full_name: string | null;
};

export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, site_id, role, full_name")
    .maybeSingle();

  if (error) {
    // If table exists and RLS is correct, this should not error for logged-in users
    console.error("getMyProfile error:", error);
    throw error;
  }

  return (data as Profile) ?? null;
}

export async function createCompanyAndFirstSite(params: {
  companyName: string;
  siteName: string;
  address?: string;
}) {
  const { companyName, siteName, address } = params;

  // 1) create company
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .insert({ name: companyName })
    .select("id, name")
    .single();

  if (companyErr) throw companyErr;

  // 2) create site
  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .insert({ company_id: company.id, name: siteName, address: address ?? null })
    .select("id, name, company_id")
    .single();

  if (siteErr) throw siteErr;

  // 3) create profile (owner)
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) throw new Error("No authenticated user found.");

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: userId,
    company_id: company.id,
    site_id: site.id,
    role: "owner",
    full_name: null,
  });

  if (profileErr) throw profileErr;

  return { company, site };
}

export async function listMySites(companyId: string) {
  const { data, error } = await supabase
    .from("sites")
    .select("id, name, address, company_id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function setCurrentSite(siteId: string) {
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) throw new Error("No authenticated user found.");

  const { error } = await supabase
    .from("profiles")
    .update({ site_id: siteId })
    .eq("id", userId);

  if (error) throw error;
}
