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
    const roles = await getRoles(user.id);
    return { user, isAdmin: roles.isAdmin, isContador: roles.isContador, isFinance: roles.isFinance };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
