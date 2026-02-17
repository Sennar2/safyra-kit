import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  email: string;
  password: string; // required for email+password login
  company_id: string;
  role: "owner" | "manager" | "staff";
  site_ids?: string[];
};

async function findUserIdByEmail(admin: any, email: string) {
  // Supabase JS Admin doesn't always have getUserByEmail; we safely fallback to listUsers paging.
  let page = 1;
  const perPage = 200;

  // hard cap to prevent infinite loops
  for (let i = 0; i < 25; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = (data?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (match?.id) return match.id;

    if (!data?.users || data.users.length < perPage) break;
    page++;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY"); // ✅ must NOT start with SUPABASE_

    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    if (!serviceRoleKey) throw new Error("Missing SERVICE_ROLE_KEY secret");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as Payload;

    if (!body.email || !body.password || !body.company_id || !body.role) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // 1) Create or reuse auth user
    let userId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (createErr) {
      // If user already exists, reuse
      const msg = String((createErr as any)?.message ?? createErr);
      const looksLikeExists =
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("exists") ||
        msg.toLowerCase().includes("registered");

      if (!looksLikeExists) throw createErr;

      userId = await findUserIdByEmail(admin, body.email);
      if (!userId) throw new Error("User exists but could not be found via listUsers()");
    } else {
      userId = created?.user?.id ?? null;
    }

    if (!userId) throw new Error("User id missing");

    // 2) Ensure profile row exists
    const { error: profErr } = await admin.from("profiles").upsert(
      { id: userId },
      { onConflict: "id" }
    );
    if (profErr) throw profErr;

    // 3) Assign to company (upsert so re-running doesn’t break)
    // NOTE: This assumes you have a UNIQUE constraint on (company_id, user_id) in company_users
    const { error: cuErr } = await admin.from("company_users").upsert(
      {
        company_id: body.company_id,
        user_id: userId,
        role: body.role,
        is_active: true,
      },
      { onConflict: "company_id,user_id" }
    );
    if (cuErr) throw cuErr;

    // 4) Optional site assignments
    const siteIds = body.site_ids ?? [];
    if (siteIds.length > 0) {
      const rows = siteIds.map((site_id) => ({
        site_id,
        user_id: userId,
      }));

      // also safe-upsert if you have unique(site_id,user_id)
      const { error: suErr } = await admin.from("site_users").upsert(rows, {
        onConflict: "site_id,user_id",
      });
      if (suErr) throw suErr;
    }

    return new Response(JSON.stringify({ user_id: userId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
