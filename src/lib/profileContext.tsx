import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyProfile, listMySites, setCurrentSite } from "@/lib/profile";

type Site = {
  id: string;
  name: string;
  address?: string | null;
  company_id: string;
};

type ProfileState = {
  loading: boolean;
  profile: null | {
    id: string;
    company_id: string | null;
    site_id: string | null;
    role: "owner" | "manager" | "staff";
    full_name: string | null;
  };
  sites: Site[];
  currentSite: Site | null;
  refresh: () => Promise<void>;
  switchSite: (siteId: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileState | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileState["profile"]>(null);
  const [sites, setSites] = useState<Site[]>([]);

  const refresh = async () => {
    if (!user) {
      setProfile(null);
      setSites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const p = await getMyProfile();
      setProfile(p);

      if (p?.company_id) {
        const s = await listMySites(p.company_id);
        setSites(s as Site[]);
      } else {
        setSites([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const currentSite = useMemo(() => {
    if (!profile?.site_id) return null;
    return sites.find((s) => s.id === profile.site_id) ?? null;
  }, [profile?.site_id, sites]);

  const switchSite = async (siteId: string) => {
    await setCurrentSite(siteId);
    await refresh();
  };

  const value = useMemo<ProfileState>(
    () => ({
      loading,
      profile,
      sites,
      currentSite,
      refresh,
      switchSite,
    }),
    [loading, profile, sites, currentSite]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
