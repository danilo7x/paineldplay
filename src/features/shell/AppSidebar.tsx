import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Megaphone,
  Sparkles,
  Columns3,
  Zap,
  Database,
  CalendarClock,
  BarChart3,
  MessageSquareText,
  HeartHandshake,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
import { cn } from "@/lib/utils";

type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  financeOnly?: boolean;
  commercialOnly?: boolean;
  /** Regra de item ativo quando a URL não basta (ex.: /leads contém as outras páginas). */
  match?: (pathname: string) => boolean;
};

/** Menu principal: o dia a dia de todo mundo. */
const workspace: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Sucesso do Cliente", url: "/sucesso", icon: HeartHandshake },
  { title: "Clientes", url: "/clientes", icon: Contact },
  { title: "Faturamento", url: "/faturamento", icon: Wallet },
  { title: "Analytics", url: "/analytics", icon: LineChart },
];

const comercial: Item[] = [
  {
    title: "Kanban de leads",
    url: "/leads",
    icon: Columns3,
    commercialOnly: true,
    // A página do lead (/leads/<id>) também pertence ao Kanban.
    match: (p) => p === "/leads" || p === "/leads/" || /^\/leads\/[0-9a-f-]{36}$/i.test(p),
  },
  { title: "Agenda comercial", url: "/leads/agenda", icon: CalendarClock, commercialOnly: true },
  { title: "Fluxo de cadência", url: "/leads/cadencia", icon: Zap, commercialOnly: true },
  { title: "Banco de leads", url: "/leads/banco", icon: Database, commercialOnly: true },
  { title: "Relatórios", url: "/leads/relatorios", icon: BarChart3, commercialOnly: true },
  {
    // Templates, roteiro e objeções ficam numa página só, com abas.
    title: "Ferramentas de venda",
    url: "/ferramentas/templates",
    icon: MessageSquareText,
    commercialOnly: true,
    match: (p) => p.startsWith("/ferramentas"),
  },
];

const gestao: Item[] = [
  { title: "Financeiro", url: "/financeiro", icon: Banknote, financeOnly: true },
  { title: "Equipe", url: "/equipe", icon: Users, adminOnly: true },
  { title: "Central dos Sócios", url: "/socios", icon: Handshake, adminOnly: true },
];

/** Comunicação interna. Perfil, arquivos, notas e atividade ficam no menu do avatar (topo). */
const geral: Item[] = [
  { title: "Avisos", url: "/avisos", icon: Megaphone },
  { title: "Rani", url: "/rani", icon: Sparkles },
];

const GROUPS_KEY = "dplay-sidebar-grupos";

function isActive(item: Item, pathname: string) {
  return item.match
    ? item.match(pathname)
    : pathname === item.url || pathname.startsWith(item.url + "/");
}

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin, isFinance, hasCommercial } = AuthRoute.useRouteContext();
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

  // Grupos recolhíveis: lembra o que a pessoa abriu e sempre abre o grupo da página atual.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setOpen(JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}"));
    } catch {
      /* sem localStorage: segue com tudo fechado */
    }
  }, []);
  function toggle(key: string, value: boolean) {
    setOpen((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  }

  const visible = (items: Item[]) =>
    items.filter(
      (i) =>
        (!i.adminOnly || isAdmin) &&
        (!i.financeOnly || isFinance) &&
        (!i.commercialOnly || hasCommercial),
    );

  const renderItems = (items: Item[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const active = isActive(item, pathname);
        const badge = item.url === "/avisos" && unread > 0 ? unread : null;
        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={item.title}
              className="h-9 text-[13px] text-sidebar-foreground/80 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground"
            >
              <Link to={item.url as never}>
                <item.icon className={cn("size-4", active ? "text-primary" : "opacity-70")} />
                <span className="flex-1 truncate">{item.title}</span>
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
  );

  const renderGroup = (key: string, label: string | null, items: Item[], collapsible = false) => {
    const filtered = visible(items);
    if (!filtered.length) return null;
    const hasActive = filtered.some((i) => isActive(i, pathname));
    const isOpen = !collapsible || collapsed || hasActive || !!open[key];
    return (
      <SidebarGroup className="py-1">
        {label && !collapsed && (
          collapsible ? (
            <button
              type="button"
              onClick={() => toggle(key, !isOpen)}
              aria-expanded={isOpen}
              className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-sidebar-foreground/55 transition hover:text-sidebar-foreground"
            >
              <span className="flex-1 text-left">{label}</span>
              <ChevronRight
                className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
              />
            </button>
          ) : (
            <SidebarGroupLabel className="text-sidebar-foreground/55">{label}</SidebarGroupLabel>
          )
        )}
        {isOpen && <SidebarGroupContent>{renderItems(filtered)}</SidebarGroupContent>}
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pb-2 pt-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 rounded-md px-1 py-1">
          <img src={logo.url} alt="" className="size-7 shrink-0 object-contain" />
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">DPlay CRM</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1">
        {renderGroup("workspace", null, workspace)}
        {renderGroup("comercial", "Comercial", comercial, true)}
        {renderGroup("gestao", "Gestão", gestao, true)}
        {renderGroup("geral", "Comunicação", geral)}
      </SidebarContent>
    </Sidebar>
  );
}
