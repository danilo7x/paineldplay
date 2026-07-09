import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  DollarSign,
  FolderKanban,
  Megaphone,
  PiggyBank,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile-context";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const periods = ["1D", "1S", "1M", "6M", "1A"] as const;
type Period = (typeof periods)[number];

const brl = (n: number) => {
  const abs = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Math.abs(n),
  );
  return n < 0 ? `-${abs}` : abs;
};

function buildChart(
  sales: { valor: number; data: string; status: string }[],
  period: Period,
) {
  const now = new Date();
  let months = 6;
  if (period === "1D" || period === "1S" || period === "1M") months = 3;
  else if (period === "6M") months = 6;
  else if (period === "1A") months = 12;
  const buckets: { d: string; key: string; v: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      d: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      key: d.toISOString().slice(0, 7),
      v: 0,
    });
  }
  const map = new Map(buckets.map((b) => [b.key, b] as const));
  sales
    .filter((s) => s.status !== "cancelado")
    .forEach((s) => {
      const k = s.data.slice(0, 7);
      const b = map.get(k);
      if (b) b.v += Number(s.valor);
    });
  return buckets;
}

function DashboardPage() {
  const { isAdmin, isFinance } = Route.useRouteContext();
  const { firstName } = useProfile();
  const [period, setPeriod] = useState<Period>("1M");
  const [loading, setLoading] = useState(true);
  const [projectStats, setProjectStats] = useState<{ total: number; ativos: number }>({
    total: 0,
    ativos: 0,
  });
  const [teamCount, setTeamCount] = useState(0);
  const [sales, setSales] = useState<{ valor: number; data: string; status: string }[]>([]);
  const [expensesMes, setExpensesMes] = useState(0);
  const [projectsList, setProjectsList] = useState<
    { id: string; nome: string; cliente: string | null; status: string; updated_at: string }[]
  >([]);
  const [activities, setActivities] = useState<
    {
      id: string;
      acao: string;
      entity_type: string;
      entity_name: string | null;
      created_at: string;
      actor_id: string | null;
    }[]
  >([]);
  const [actorMap, setActorMap] = useState<Record<string, string>>({});
  const [recentNotices, setRecentNotices] = useState<
    { id: string; titulo: string; created_at: string; prioridade: string; critico: boolean }[]
  >([]);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("dplay_welcome_seen");
  });

  // Welcome animation once per session
  useEffect(() => {
    if (!showWelcome) return;
    sessionStorage.setItem("dplay_welcome_seen", "1");
    const t = setTimeout(() => setShowWelcome(false), 2200);
    return () => clearTimeout(t);
  }, [showWelcome]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthKey = monthStart.toISOString().slice(0, 10);
      const [projectsRes, salesRes, teamRes, expRes, actRes, notRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, nome, cliente, status, updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("sales").select("valor, data, status"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("ativo", true),
        isFinance
          ? supabase.from("expenses").select("valor").gte("data", monthKey)
          : Promise.resolve({ data: [] as { valor: number }[] } as const),
        supabase
          .from("activity_logs")
          .select("id, acao, entity_type, entity_name, created_at, actor_id")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("notices")
          .select("id, titulo, created_at, prioridade, critico")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);
      if (!alive) return;
      const rows = (projectsRes.data ?? []) as {
        id: string;
        nome: string;
        cliente: string | null;
        status: string;
        updated_at: string;
      }[];
      setProjectStats({
        total: rows.length,
        ativos: rows.filter((r) => r.status !== "concluido" && r.status !== "pausado").length,
      });
      setProjectsList(rows);
      setSales((salesRes.data ?? []) as { valor: number; data: string; status: string }[]);
      setTeamCount(teamRes.count ?? 0);
      const eList = (expRes.data ?? []) as { valor: number }[];
      setExpensesMes(eList.reduce((a, e) => a + Number(e.valor), 0));
      const acts = (actRes.data ?? []) as typeof activities;
      setActivities(acts);
      setRecentNotices((notRes.data ?? []) as typeof recentNotices);
      const actorIds = Array.from(
        new Set(acts.map((a) => a.actor_id).filter(Boolean) as string[]),
      );
      if (actorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", actorIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          map[p.id] = p.nome ?? p.email ?? "Alguém";
        });
        if (alive) setActorMap(map);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isFinance]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKey = monthStart.toISOString().slice(0, 10);
  const salesMes = sales.filter((s) => s.data >= monthKey && s.status !== "cancelado");
  const receitaMes = salesMes.reduce((a, s) => a + Number(s.valor), 0);
  const lucroMes = receitaMes - expensesMes;

  const baseKpis = [
    {
      key: "receita",
      label: isFinance ? "Receita do mês" : "Sua receita no mês",
      value: brl(receitaMes),
      icon: DollarSign,
      hint: salesMes.length === 0 ? "Nenhuma venda" : `${salesMes.length} vendas no mês`,
    },
    {
      key: "projetos",
      label: "Projetos ativos",
      value: String(projectStats.ativos),
      icon: FolderKanban,
      hint:
        projectStats.total === 0 ? "Nenhum cadastrado" : `${projectStats.total} no total`,
    },
    {
      key: "vendas",
      label: "Vendas no mês",
      value: String(salesMes.length),
      icon: TrendingUp,
      hint: salesMes.length === 0 ? "Aguardando registros" : "Contando pagas e pendentes",
    },
    {
      key: "equipe",
      label: "Equipe",
      value: String(teamCount || 1),
      icon: Users,
      hint: "Ativos no CRM",
    },
  ];
  const kpis = isFinance
    ? [
        baseKpis[0],
        {
          key: "lucro",
          label: "Lucro do mês",
          value: brl(lucroMes),
          icon: PiggyBank,
          hint:
            receitaMes === 0
              ? "Sem receita ainda"
              : `${((lucroMes / receitaMes) * 100).toFixed(1)}% de margem`,
          accent: lucroMes < 0 ? "text-rose-300" : undefined,
        },
        baseKpis[1],
        baseKpis[2],
        baseKpis[3],
      ]
    : baseKpis;

  const chartData = useMemo(() => buildChart(sales, period), [sales, period]);

  const attentionProjects = useMemo(
    () =>
      projectsList
        .filter((p) => p.status === "em_manutencao" || p.status === "pausado")
        .slice(0, 5),
    [projectsList],
  );

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-primary/80">DPlay Solutions</p>
              <h1 className="mt-3 bg-gradient-to-br from-white via-white to-primary bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
                Bem-vindo, {firstName}
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: showWelcome ? 0.6 : 0 } },
      }}
    >
      <motion.header
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Visão geral</p>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
            Olá, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFinance
              ? "Você tem acesso total ao painel."
              : "Seus projetos e faturamento aparecerão aqui."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {isAdmin ? "Administrador" : isFinance ? "Contadora" : "Colaborador"}
        </span>
      </motion.header>

      <motion.div
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          isFinance ? "xl:grid-cols-5" : "xl:grid-cols-4",
        )}
      >
        {loading
          ? Array.from({ length: isFinance ? 5 : 4 }).map((_, i) => (
              <Card key={i} className="rounded-2xl border-border/50 bg-card/40 backdrop-blur-xl">
                <CardContent className="p-6">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-4 h-8 w-32" />
                  <Skeleton className="mt-4 h-3 w-20" />
                </CardContent>
              </Card>
            ))
          : kpis.map((k) => (
          <Card
            key={k.key}
            className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl transition hover:border-primary/40"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{k.value}</p>
                </div>
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <k.icon className="size-4" />
                </div>
              </div>
              <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRight className="size-3" /> {k.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Faturamento
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Evolução do faturamento
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Vendas agregadas por mês, respeitando seu nível de acesso.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card/60 p-1">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    period === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 h-72 w-full">
            {loading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#057EF3" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#057EF3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="d"
                  stroke="rgba(255,255,255,0.35)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.35)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(11,15,26,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#31B7FF"
                  strokeWidth={2}
                  fill="url(#fillBlue)"
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
        className="grid gap-4 lg:grid-cols-3"
      >
        {/* Últimas atividades */}
        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Activity className="size-4" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Atividade
                  </p>
                  <h3 className="text-sm font-semibold tracking-tight">Últimas atividades</h3>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {isAdmin ? "Nenhuma atividade ainda." : "Nada por aqui — suas ações aparecerão aqui."}
              </p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-xs">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium text-foreground">
                          {a.actor_id ? actorMap[a.actor_id] ?? "Alguém" : "Sistema"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {a.acao.replace(/_/g, " ")} {a.entity_type}
                        </span>{" "}
                        <span className="text-foreground/80">{a.entity_name ?? ""}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Avisos recentes */}
        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Megaphone className="size-4" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Comunicação
                  </p>
                  <h3 className="text-sm font-semibold tracking-tight">Avisos recentes</h3>
                </div>
              </div>
              <Link
                to="/avisos"
                className="text-[11px] text-primary transition hover:underline"
              >
                Ver todos
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : recentNotices.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum aviso publicado.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentNotices.map((n) => {
                  const dot =
                    n.prioridade === "urgente"
                      ? "bg-rose-400"
                      : n.prioridade === "alerta"
                      ? "bg-amber-400"
                      : "bg-sky-400";
                  return (
                    <li key={n.id}>
                      <Link
                        to="/avisos"
                        className="flex items-start gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs transition hover:border-primary/40"
                      >
                        <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5">
                            <span className="line-clamp-1 font-medium">{n.titulo}</span>
                            {n.critico && (
                              <span className="rounded-full bg-rose-500/15 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-rose-300">
                                crítico
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Projetos em atenção */}
        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20">
                  <AlertTriangle className="size-4" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Operação
                  </p>
                  <h3 className="text-sm font-semibold tracking-tight">Projetos em atenção</h3>
                </div>
              </div>
              <Link
                to="/projetos"
                className="text-[11px] text-primary transition hover:underline"
              >
                Ver todos
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : attentionProjects.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum projeto pausado ou em manutenção.
              </p>
            ) : (
              <ul className="space-y-2">
                {attentionProjects.map((p) => {
                  const label = p.status === "em_manutencao" ? "Manutenção" : "Pausado";
                  const tone =
                    p.status === "em_manutencao"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-slate-500/40 bg-slate-500/10 text-slate-300";
                  return (
                    <li key={p.id}>
                      <Link
                        to="/projetos/$id"
                        params={{ id: p.id }}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs transition hover:border-primary/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.nome}</p>
                          {p.cliente && (
                            <p className="truncate text-[10px] text-muted-foreground">
                              {p.cliente}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${tone}`}
                        >
                          {label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
    </>
  );
}