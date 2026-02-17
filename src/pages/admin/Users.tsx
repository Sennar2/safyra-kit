import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listCompanies, type CompanyRow } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CompanyRole = "owner" | "manager" | "staff";

type CompanyUserRow = {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  created_at?: string;
};

export default function AdminUsers() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyId, setCompanyId] = useState<string>("");

  const [members, setMembers] = useState<CompanyUserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CompanyRole>("manager");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!companyId && email.trim().length > 3 && password.trim().length >= 8 && !loading;
  }, [companyId, email, password, loading]);

  const loadCompanies = async () => {
    const rows = await listCompanies();
    setCompanies(rows);
    if (!companyId && rows[0]?.id) setCompanyId(rows[0].id);
  };

  const loadMembers = async (cid: string) => {
    setError(null);
    setMembers([]);

    const { data, error } = await supabase
      .from("company_users")
      .select("id, company_id, user_id, role, created_at")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setMembers((data ?? []) as CompanyUserRow[]);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadCompanies();
      } catch (e: any) {
        setError(e?.message ?? "Failed to load companies");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!companyId) return;
    loadMembers(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const createUser = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const e = email.trim().toLowerCase();
      const p = password.trim();

      // 1) Create Auth user (edge function uses service role)
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: e, password: p },
      });

      if (error) throw error;

      const createdUserId = (data as any)?.user_id ?? (data as any)?.user?.id ?? null;
      if (!createdUserId) {
        throw new Error("User created, but function did not return user_id.");
      }

      // 2) Assign membership to the selected company
      const { error: assignErr } = await supabase.from("company_users").insert([
        {
          company_id: companyId,
          user_id: createdUserId,
          role, // enum: owner | manager | staff
        },
      ]);

      if (assignErr) throw assignErr;

      setSuccess(`User created and assigned as ${role}.`);
      setEmail("");
      setPassword("");

      await loadMembers(companyId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold">Create user</h2>
          <p className="text-sm text-muted-foreground">
            Super admin creates auth users + assigns them to a company.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Company</label>
            <select
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Temporary password</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars"
                type="password"
                autoComplete="new-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) createUser();
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <select
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as CompanyRole)}
            >
              <option value="owner">owner</option>
              <option value="manager">manager</option>
              <option value="staff">staff</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <Button onClick={createUser} disabled={!canSubmit}>
            {loading ? "Creating..." : "Create user"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Company members</h2>
            <p className="text-xs text-muted-foreground">Users assigned to the selected company.</p>
          </div>
          <Button variant="outline" onClick={() => companyId && loadMembers(companyId)} disabled={!companyId || loading}>
            Refresh
          </Button>
        </div>

        <div className="p-5">
          {!companyId ? (
            <p className="text-sm text-muted-foreground">Select a company.</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-xl border border-border px-4 py-3"
                >
                  <div>
                    <div className="font-semibold">{m.user_id}</div>
                    <div className="text-xs text-muted-foreground">{m.role}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            Next upgrade: show name + email by joining profiles (once profiles are synced).
          </p>
        </div>
      </div>
    </div>
  );
}
