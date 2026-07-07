import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, DollarSign, FolderKanban, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

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
  const { user, isAdmin } = Route.useRouteContext();
  const [period, setPeriod] = useState<Period>("1M");
  const [projectStats, setProjectStats] = useState<{ total: number; ativos: number }>({
    total: 0,
    ativos: 0,
  });
  const [teamCount, setTeamCount] = useState(0);
  const [sales, setSales] = useState<{ valor: number; data: string; status: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [projectsRes, salesRes, teamRes] = await Promise.all([
        supabase.from("projects").select("status"),
        supabase.from("sales").select("valor, data, status"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("ativo", true),
      ]);
      const rows = projectsRes.data ?? [];
      setProjectStats({
        total: rows.length,
        ativos: rows.filter((r) => r.status !== "concluido" && r.status !== "pausado").length,
      });
      setSales((salesRes.data ?? []) as { valor: number; data: string; status: string }[]);
      setTeamCount(teamRes.count ?? 0);
    })();
  }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKey = monthStart.toISOString().slice(0, 10);
  const salesMes = sales.filter((s) => s.data >= monthKey && s.status !== "cancelado");
  const receitaMes = salesMes.reduce((a, s) => a + Number(s.valor), 0);

  const kpis = [
    {
      key: "receita",
      label: isAdmin ? "Receita do mês" : "Sua receita no mês",
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

  const chartData = useMemo(() => buildChart(sales, period), [sales, period]);

  return (
    <div className="space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Visão geral</p>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
            Olá, {user.email?.split("@")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Você tem acesso total ao painel."
              : "Seus projetos e faturamento aparecerão aqui."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {isAdmin ? "Administrador" : "Colaborador"}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
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
      </div>

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}