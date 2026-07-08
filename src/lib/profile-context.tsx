import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserProfile = {
  id: string;
  nome: string | null;
  email: string | null;
  cargo: string | null;
  avatar_url: string | null;
  updated_at?: string | null;
};

type Ctx = {
  profile: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  firstName: string;
  initials: string;
};

const ProfileCtx = createContext<Ctx | null>(null);

export function ProfileProvider({ userId, email, children }: { userId: string; email: string | null; children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, email, cargo, avatar_url, updated_at")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as UserProfile | null) ?? { id: userId, nome: null, email, cargo: null, avatar_url: null });
    setLoading(false);
  }, [userId, email]);

  useEffect(() => {
    void refresh();
    // Listen for cross-tab / same-tab profile updates
    const onUpdated = () => void refresh();
    window.addEventListener("dplay:profile-updated", onUpdated);
    return () => window.removeEventListener("dplay:profile-updated", onUpdated);
  }, [refresh]);

  const nome = profile?.nome?.trim() ?? "";
  const firstName =
    nome.split(/\s+/)[0] || email?.split("@")[0] || "por aqui";
  const initialsSource = nome || email || "?";
  const initials = initialsSource
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ProfileCtx.Provider value={{ profile, loading, refresh, firstName, initials }}>
      {children}
    </ProfileCtx.Provider>
  );
}

export function useProfile(): Ctx {
  const v = useContext(ProfileCtx);
  if (!v) throw new Error("useProfile must be used inside ProfileProvider");
  return v;
}

/** Chame após salvar o perfil para propagar em todo o app. */
export function notifyProfileUpdated() {
  window.dispatchEvent(new Event("dplay:profile-updated"));
}