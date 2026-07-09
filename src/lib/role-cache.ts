import { supabase } from "@/integrations/supabase/client";

export type Roles = {
  isAdmin: boolean;
  isContador: boolean;
  isFinance: boolean; // admin OR contador
};

const cache = new Map<string, Roles>();
let listenerBound = false;

function bindListener() {
  if (listenerBound) return;
  listenerBound = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED") cache.clear();
  });
}

export async function getRoles(userId: string): Promise<Roles> {
  bindListener();
  const cached = cache.get(userId);
  if (cached) return cached;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  const isAdmin = roles.includes("admin");
  const isContador = roles.includes("contador");
  const out: Roles = { isAdmin, isContador, isFinance: isAdmin || isContador };
  cache.set(userId, out);
  return out;
}

export async function getIsAdmin(userId: string): Promise<boolean> {
  return (await getRoles(userId)).isAdmin;
}

export function clearRoleCache() {
  cache.clear();
}