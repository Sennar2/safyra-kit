import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCompany,
  setCompanyStatus,
  listCompanyUsers,
  addCompanyUser,
  removeCompanyUser,
} from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Building2, ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { useTenant } from "@/lib/tenantContext";

const ROLE_OPTIONS = ["owner", "manager", "staff"] as const;

export default function CompanyDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const tenant = useTenant() as any;

  const [company, setCompany] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Add user form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("manager");
  const [adding, setAdding] = useState(false);

  const isInactive = useMemo(() => {
    const s = (company?.status ?? "active").toString().toLowerCase();
    return s === "inactive" || s === "disabled";
  }, [company?.status]);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const c = await getCompany(companyId);
      setCompany(c);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!companyId) return;
    setUsersLoading(true);
    try {
      const u = await listCompanyUsers(companyId);
      setUsers(u);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const toggleStatus = async () => {
    if (!companyId || !company) return;
    const next = isInactive ? "active" : "inactive";
    await setCompanyStatus(companyId, next);
    await load();
  };

  const enterAsCompany = async () => {
    if (!company) return;

    if (typeof tenant.setActiveCompany === "function") tenant.setActiveCompany(company);
    if (typeof tenant.setActiveCompanyId === "function") tenant.setActiveCompanyId(company.id);

    try {
      localStorage.setItem("safyra_active_company_id", company.id);
      localStorage.setItem("active_company_id", company.id);
    } catch {}

    navigate("/app");
  };

  const onAddUser = async () => {
    if (!companyId) return;
    if (email.trim().length < 5) return;
    if (password.trim().length < 8) return;

    setAdding(true);
    try {
      await addCompanyUser(companyId, { email: email.trim(), password: password.trim(), role });
      setEmail("");
      setPassword("");
      setRole("manager");
      await loadUsers();
    } finally {
      setAdding(false);
    }
  };

  const onRemoveUser = async (companyUserId: string) => {
    if (!companyId) return;
    await removeCompanyUser(companyUserId);
    await loadUsers();
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={() => navigate("/admin/companies")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Companies
          </button>

          <div className="mt-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {loading ? "Loading…" : company?.name ?? "Company"}
            </h1>
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            Company overview, status, users, and quick access to the tenant app.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={toggleStatus} disabled={loading || !company}>
            {isInactive ? "Activate" : "Deactivate"}
          </Button>

          <Button onClick={enterAsCompany} disabled={!company || isInactive}>
            Enter app <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="mt-2 inline-flex items-center gap-2">
            <span className={"h-2.5 w-2.5 rounded-full " + (isInactive ? "bg-destructive" : "bg-primary")} />
            <div className="text-lg font-extrabold">{isInactive ? "Inactive" : "Active"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Company ID</div>
          <div className="mt-2 font-mono text-xs break-all">{company?.id ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Created: {company?.created_at ? new Date(company.created_at).toLocaleString() : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Quick actions</div>
          <div className="mt-3 space-y-2">
            <Button className="w-full" onClick={enterAsCompany} disabled={!company || isInactive}>
              Enter app as owner <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => alert("Next: Locations management page (we’ll build next).")}
            >
              Manage locations (next)
            </Button>
          </div>
        </div>
      </div>

      {/* Users */}
      <div className="mt-8 rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold">Company users</h2>
            <p className="text-xs text-muted-foreground">Assign roles: owner / manager / staff.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            Super admin view
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-border p-4">
            <div className="font-semibold mb-2">Add user to this company</div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary password (min 8 chars)"
                type="password"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <Button onClick={onAddUser} disabled={adding || email.trim().length < 5 || password.trim().length < 8}>
                <UserPlus className="w-4 h-4 mr-2" />
                {adding ? "Adding…" : "Add user"}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground mt-2">
              This creates (or reuses) the auth user and assigns them to this company.
            </div>
          </div>

          {usersLoading ? (
            <div className="text-sm text-muted-foreground">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground">No users assigned yet.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{u.email ?? u.user_id}</div>
                    <div className="text-xs text-muted-foreground">
                      Role: <span className="font-semibold">{u.role}</span>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => onRemoveUser(u.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
