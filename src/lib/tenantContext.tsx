// src/lib/tenantContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type SiteLite = { id: string; name: string };

type ActiveCompanyLite = { id: string; name: string | null };

type TenantContextValue = {
  // company
  activeCompanyId: string | null;
  activeCompanyName: string | null;
  setActiveCompany: (c: ActiveCompanyLite) => void;
  setActiveCompanyId: (id: string | null) => void;
  clearActiveCompany: () => void;

  // role + loading
  loading: boolean;
  roleInActiveCompany: string | null;

  // sites
  sites: SiteLite[];
  activeSiteId: string | null;
  setActiveSiteId: (id: string | null) => void;
  refreshSites: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const LS_COMPANY_ID = "safyra_active_company_id";
const LS_COMPANY_NAME = "safyra_active_company_name";
const LS_SITE_ID = "safyra_active_site_id";

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(null);

  const [roleInActiveCompany, setRoleInActiveCompany] = useState<string | null>(null);

  const [sites, setSites] = useState<SiteLite[]>([]);
  const [activeSiteId, setActiveSiteIdState] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // --- setters
  const setActiveCompanyId = (id: string | null) => {
    setActiveCompanyIdState(id);
    if (id) localStorage.setItem(LS_COMPANY_ID, id);
    else localStorage.removeItem(LS_COMPANY_ID);
  };

  const setActiveCompany = (c: ActiveCompanyLite) => {
    setActiveCompanyId(c.id);
    setActiveCompanyName(c.name ?? null);
    if (c.name) localStorage.setItem(LS_COMPANY_NAME, c.name);
    else localStorage.removeItem(LS_COMPANY_NAME);
  };

  const clearActiveCompany = () => {
    setActiveCompanyIdState(null);
    setActiveCompanyName(null);
    setRoleInActiveCompany(null);
    setSites([]);
    setActiveSiteIdState(null);

    localStorage.removeItem(LS_COMPANY_ID);
    localStorage.removeItem(LS_COMPANY_NAME);
    localStorage.removeItem(LS_SITE_ID);
  };

  const setActiveSiteId = (id: string | null) => {
    setActiveSiteIdState(id);
    if (id) localStorage.setItem(LS_SITE_ID, id);
    else localStorage.removeItem(LS_SITE_ID);
  };

  // restore from localStorage once
  useEffect(() => {
    const savedCompanyId = localStorage.getItem(LS_COMPANY_ID);
    const savedCompanyName = localStorage.getItem(LS_COMPANY_NAME);
    const savedSiteId = localStorage.getItem(LS_SITE_ID);

    setActiveCompanyIdState(savedCompanyId || null);
    setActiveCompanyName(savedCompanyName || null);
    setActiveSiteIdState(savedSiteId || null);
  }, []);

  const refreshSites = useCallback(async () => {
    if (!activeCompanyId) {
      setSites([]);
      return;
    }
    const { data, error } = await supabase
      .from("sites")
      .select("id,name")
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const mapped = (data ?? []).map((x: any) => ({ id: x.id, name: x.name })) as SiteLite[];
    setSites(mapped);

    // keep activeSiteId valid (or pick first)
    const stillValid = mapped.some((s) => s.id === activeSiteId);
    if (!stillValid) {
      setActiveSiteId(mapped[0]?.id ?? null);
    }
  }, [activeCompanyId, activeSiteId]);

  // load role + sites whenever activeCompanyId changes
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading) return;

      // not logged in
      if (!user?.id) {
        if (!cancelled) {
          setLoading(false);
          clearActiveCompany();
        }
        return;
      }

      // no company selected
      if (!activeCompanyId) {
        if (!cancelled) {
          setLoading(false);
          setRoleInActiveCompany(null);
          setSites([]);
          setActiveSiteIdState(null);
        }
        return;
      }

      setLoading(true);
      try {
        // role in company
        const { data: cu, error: cuErr } = await supabase
          .from("company_users")
          .select("role")
          .eq("company_id", activeCompanyId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cuErr) throw cuErr;

        if (!cancelled) {
          setRoleInActiveCompany((cu as any)?.role ?? null);
        }

        // sites
        await refreshSites();
      } catch (e) {
        console.error("TenantProvider load error:", e);
        if (!cancelled) {
          setRoleInActiveCompany(null);
          setSites([]);
          setActiveSiteIdState(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, activeCompanyId]);

  const value = useMemo<TenantContextValue>(
    () => ({
      activeCompanyId,
      activeCompanyName,
      setActiveCompany,
      setActiveCompanyId,
      clearActiveCompany,
      loading,
      roleInActiveCompany,
      sites,
      activeSiteId,
      setActiveSiteId,
      refreshSites,
    }),
    [
      activeCompanyId,
      activeCompanyName,
      loading,
      roleInActiveCompany,
      sites,
      activeSiteId,
      refreshSites,
    ]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
