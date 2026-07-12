import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  FolderKanban,
  LineChart,
  Banknote,
  Users,
  Handshake,
  Contact,
  FolderLock,
  StickyNote,
  Megaphone,
  Sparkles,
  UserRound,
  Activity,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "@/routes/_authenticated";
import logo from "@/assets/dplay-logo-transparent.png.asset.json";
import { useProfile } from "@/lib/profile-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  financeOnly?: boolean;
};

const workspace: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Faturamento", url: "/faturamento", icon: Wallet },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Clientes", url: "/clientes", icon: Contact },
  { title: "Analytics", url: "/analytics", icon: LineChart },
];

const admin: Item[] = [
  { title: "Financeiro", url: "/financeiro", icon: Banknote, financeOnly: true },
  { title: "Equipe", url: "/equipe", icon: Users, adminOnly: true },
  { title: "Central dos Sócios", url: "/socios", icon: Handshake, adminOnly: true },
];

const personal: Item[] = [
  { title: "Meus Arquivos", url: "/arquivos", icon: FolderLock },
  { title: "Notas", url: "/notas", icon: StickyNote },
  { title: "Avisos", url: "/avisos", icon: Megaphone },
  { title: "Rani", url: "/rani", icon: Sparkles },
  { title: "Perfil", url: "/perfil", icon: UserRound },
  { title: "Atividade", url: "/atividade", icon: Activity },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, isAdmin, isFinance, isContador } = AuthRoute.useRouteContext();
  const { profile, firstName, initials } = useProfile();
  const { data: unread = 0 } = useQuery({
    queryKey: ["sidebar-unread", user.id],
    queryFn: async () => {
      const [n, r] = await Promise.all([
        supabase.from("notices").select("id", { head: true, count: "exact" }),
        supabase
          .from("notice_reads")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", user.id),
      ]);
      return Math.max(0, (n.count ?? 0) - (r.count ?? 0));
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/", replace: true });
  }

  const renderGroup = (label: string, items: Item[]) => {
    const filtered = items.filter(
      (i) => (!i.adminOnly || isAdmin) && (!i.financeOnly || isFinance),
    );
    if (!filtered.length) return null;
    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map((item) => {
              const active = pathname === item.url || pathname.startsWith(item.url + "/");
              const badge = item.url === "/avisos" && unread > 0 ? unread : null;
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                    <Link to={item.url as never}>
                      <item.icon className="size-4" />
                      <span className="flex-1">{item.title}</span>
                      {badge && !collapsed && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <img
            src={logo.url}
            alt=""
            className="size-8 shrink-0 aspect-square object-contain"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">DPlay Solutions</p>
              <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                CRM interno
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Workspace", workspace)}
        {renderGroup("Administração", admin)}
        {renderGroup("Pessoal", personal)}
      </SidebarContent>

      <SidebarFooter>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <Avatar className="size-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={handleSignOut}
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-2 py-2">
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{profile?.nome || firstName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {profile?.cargo ||
                  (isAdmin
                    ? "Administrador"
                    : isContador
                      ? "Contadora"
                      : "Colaborador")}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}