import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/features/shell/AppShell";
import { getRoles } from "@/lib/role-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/" });
    // Require completed MFA when a verified TOTP factor exists on this account
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
      await supabase.auth.signOut();
      throw redirect({ to: "/" });
    }
    const roles = await getRoles(user.id);
    return {
      user,
      isAdmin: roles.isAdmin,
      isContador: roles.isContador,
      isFinance: roles.isFinance,
      hasCommercial: roles.hasCommercial,
    };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
