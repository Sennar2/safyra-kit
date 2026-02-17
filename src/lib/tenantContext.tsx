import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCompany } from "@/lib/platform"; // you already have getCompany(companyId)

type TenantContextValue = {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  tenantLoading: boolean;
  tenant: { companyId: string; companyName: string | null } | null;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const LS_KEY = "safyra_active_company_id";

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenant, setTenant] = useState<{ companyId: string; companyName: string | null } | null>(null);

  const setActiveCompanyId = (id: string | null) => {
    setActiveCompanyIdState(id);
    if (id) localStorage.setItem(LS_KEY, id);
    else localStorage.removeItem(LS_KEY);
  };

  // restore activeCompanyId once
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    setActiveCompanyIdState(saved || null);
    setTenantLoading(false);
  }, []);

  // load tenant/company info whenever company changes
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activeCompanyId) {
        setTenant(null);
        return;
      }
      try {
        const c = await getCompany(activeCompanyId);
        if (cancelled) return;
        setTenant({ companyId: c.id, companyName: c.name ?? null });
      } catch {
        // if company no longer exists or user lost access, clear it
        if (cancelled) return;
        setTenant(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  const value = useMemo(
    () => ({ activeCompanyId, setActiveCompanyId, tenantLoading, tenant }),
    [activeCompanyId, tenantLoading, tenant]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
