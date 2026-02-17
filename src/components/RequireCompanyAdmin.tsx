import { Navigate, Outlet } from "react-router-dom";
import { useTenant } from "@/lib/tenantContext";

export default function RequireCompanyAdmin() {
  const { loading, roleInActiveCompany } = useTenant();
  if (loading) return null;

  const allowed = roleInActiveCompany === "owner" || roleInActiveCompany === "manager";
  if (!allowed) return <Navigate to="/" replace />;

  return <Outlet />;
}
