import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";
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

export default function Users() {
  const { activeCompanyId } = useTenant() as any;

  const [members, setMembers] = useState<CompanyUserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<CompanyRole>("staff");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canAssign = useMemo(() => {
    return !!activeCompanyId && userId.trim().length > 10 && !loading;
  }, [activeCompanyId, userId, loading]);

  const loadMembers = async () => {
    if (!activeCompanyId) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("company_users")
        .select("id, company_id, user_id, role, created_at")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMembers((data ?? []) as CompanyUserRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  const assignUser = async () => {
    if (!activeCompanyId) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.from("company_users").insert([
        {
          company_id: activeCompanyId,
          user_id: userId.trim(),
          role,
        },
      ]);

      if (error) throw error;

      setSuccess("User assigned.");
      setUserId("");
      await loadMembers();
    } catch (e: any) {
      setError(e?.message ?? "Failed to assign user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who can access this company.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold">Assign existing user</h2>
          <p className="text-sm text-muted-foreground">
            Paste a Supabase Auth User ID and assign a role.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Auth User ID</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="uuid from auth.users"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAssign) assignUser();
                }}
              />
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
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-700">{success}</div>}

          <Button onClick={assignUser} disabled={!canAssign}>
            {loading ? "Assigning..." : "Assign user"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Company members</h2>
            <p className="text-xs text-muted-foreground">Current access list.</p>
          </div>
          <Button variant="outline" onClick={loadMembers} disabled={!activeCompanyId || loading}>
            Refresh
          </Button>
        </div>

        <div className="p-5">
          {!activeCompanyId ? (
            <div className="text-sm text-muted-foreground">Select a company first.</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-muted-foreground">No members yet.</div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
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

          <div className="text-xs text-muted-foreground mt-3">
            Next upgrade: show email/name by syncing profiles.
          </div>
        </div>
      </div>
    </div>
  );
}
