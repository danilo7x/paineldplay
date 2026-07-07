import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, boolean>();
let listenerBound = false;

function bindListener() {
  if (listenerBound) return;
  listenerBound = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED") cache.clear();
  });
}

export async function getIsAdmin(userId: string): Promise<boolean> {
  bindListener();
  const cached = cache.get(userId);
  if (cached !== undefined) return cached;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (data ?? []).some((r) => r.role === "admin");
  cache.set(userId, isAdmin);
  return isAdmin;
}

export function clearRoleCache() {
  cache.clear();
}