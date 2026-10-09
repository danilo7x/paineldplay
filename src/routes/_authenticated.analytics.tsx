import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import {
  TrendingUp,
  Users,
  PieChart as PieIcon,
  Activity,
  Filter,
  Layers,
  CalendarRange,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOARD_COLUMNS, isFinalStage, stageLabel } from "@/features/leads/model";
import { MEETING_BOOKED_TITLE } from "@/features/leads/workflow";
import { PROJECT_SERVICES } from "@/features/projects/services";

type Sale = { valor: number; data: string; project_id: string; status: string };
type Project = { id: string; nome: string; status: string; servico: string | null };
type Step = { autor_id: string | null; status: string; updated_at: string };
type Member = { user_id: string; project_id: string };
type Profile = { id: string; nome: string | null; email: string | null };
type PipelineLead = {
  etapa: string;
  valor_estimado: number | null;
  valor_proposta: number | null;
  created_at: string;
  reuniao_em: string | null;
  reuniao_status: string | null;
};
type Commercial = {
  leads: PipelineLead[];
  meetingsBooked: number | null;
};

const PALETTE = [
  "#057ef3",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];
/** Cor única das barras de série simples (mesmo azul dos demais gráficos). */
const ACCENT = "#057ef3";
const GRID = "rgba(255,255,255,0.06)";
const AXIS = "rgba(255,255,255,0.5)";

const STATUS_LABELS: Record<string, string> = {
  em_desenvolvimento: "Em desenvolvimento",
  em_manutencao: "Em manutenção",
  concluido: "Concluído",
  pausado: "Pausado",
};

/**
 * Cor de cada coluna do Kanban no gráfico do pipeline. A cor segue a etapa (não
 * o tamanho da fatia) e a ordem foi validada para separar fatias vizinhas no
 * fundo escuro, inclusive para daltônicos; "Encerrados" fica em cinza neutro.
 */
const PIPELINE_COLORS: Record<string, string> = {
  novo: "#3987e5",
  primeiro_contato: "#d95926",
  cadencia: "#199e70",
  reuniao: "#c98500",
  diagnostico: "#d55181",
  proposta: "#9085e9",
  negociacao: "#e66767",
  contrato: "#2aa3c9",
  ganho: "#3aa655",
  encerrados: "#77776f",
};

/** Etapas em que já existe proposta na mesa. */
const NEGOTIATION_STAGES = ["proposta", "negociacao", "contrato"];
/** Oportunidade: lead qualificado, da reunião de diagnóstico ao contrato. */
const OPPORTUNITY_STAGES = ["reuniao", "diagnostico", "proposta", "negociacao", "contrato"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
function fmtBRLCompact(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
function fmtInt(v: number) {
  return v.toLocaleString("pt-BR");
}
function leadValue(l: PipelineLead) {
  return Number(l.valor_proposta ?? l.valor_estimado ?? 0);
}

function firstDayOfMonth(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  d.setHours(0, 0, 0, 0);
  return d;
}
function toISODate(d: Date) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
function weekKey(d: Date) {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

const TOOLTIP_STYLE = {
  background: "rgba(11,15,26,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
} as const;
const TOOLTIP_LABEL = { color: "rgba(255,255,255,0.7)" } as const;
const TOOLTIP_ITEM = { color: "#fff" } as const;

type Period = "mes" | "ano" | "custom";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { hasCommercial } = Route.useRouteContext();
  const [period, setPeriod] = useState<Period>("ano");
  const now = useMemo(() => new Date(), []);
  const [customFrom, setCustomFrom] = useState(toISODate(firstDayOfMonth(-11)));
  const [customTo, setCustomTo] = useState(toISODate(now));

  const { from, to } = useMemo(() => {
    if (period === "mes") return { from: firstDayOfMonth(0), to: new Date() };
    if (period === "ano") return { from: firstDayOfMonth(-11), to: new Date() };
    return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
  }, [period, customFrom, customTo]);

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [commercial, setCommercial] = useState<Commercial | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCommercial(toExclusiveISO: string): Promise<Commercial | null> {
      if (!hasCommercial) return null;
      const toEnd = new Date(toExclusiveISO + "T00:00:00").toISOString();
      const [leadsRes, meetingsRes] = await Promise.all([
        // O RLS devolve o funil inteiro para admins e só os leads de cada um para os demais.
        supabase
          .from("partner_leads")
          .select("etapa, valor_estimado, valor_proposta, created_at, reuniao_em, reuniao_status"),
        supabase
          .from("lead_activities")
          .select("id", { count: "exact", head: true })
          .eq("tipo", "reuniao")
          .eq("status", "realizada")
          .eq("titulo", MEETING_BOOKED_TITLE)
          .gte("realizado_em", from.toISOString())
          .lt("realizado_em", toEnd),
      ]);
      return {
        leads: (leadsRes.data ?? []) as PipelineLead[],
        meetingsBooked: meetingsRes.error ? null : (meetingsRes.count ?? 0),
      };
    }
    async function load() {
      setLoading(true);
      const fromISO = toISODate(from);
      const toISO = toISODate(to);
      const toExclusive = addDays(toISO, 1); // inclusive .lt() next day
      const [s, p, st, m, pr, c] = await Promise.all([
        supabase
          .from("sales")
          .select("valor, data, project_id, status")
          .gte("data", fromISO)
          .lt("data", toExclusive),
        // "*" para não quebrar antes da migração que cria a coluna "servico".
        supabase.from("projects").select("*"),
        supabase
          .from("project_steps")
          .select("autor_id, status, updated_at")
          .gte("updated_at", from.toISOString())
          .lte("updated_at", to.toISOString()),
        supabase.from("project_members").select("user_id, project_id"),
        supabase.from("profiles").select("id, nome, email"),
        loadCommercial(toExclusive),
      ]);
      if (cancelled) return;
      setSales((s.data ?? []) as Sale[]);
      setProjects((p.data ?? []) as Project[]);
      setSteps((st.data ?? []) as Step[]);
      setMembers((m.data ?? []) as Member[]);
      setProfiles((pr.data ?? []) as Profile[]);
      setCommercial(c);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to, hasCommercial]);

  const paidSales = useMemo(() => sales.filter((s) => s.status !== "cancelado"), [sales]);

  // Faturamento e ticket médio (por projeto faturado: parcelas mensais não diluem o ticket)
  const revenue = useMemo(() => {
    const total = paidSales.reduce((a, s) => a + Number(s.valor), 0);
    const projectsBilled = new Set(paidSales.map((s) => s.project_id)).size;
    return {
      total,
      count: paidSales.length,
      projectsBilled,
      ticket: projectsBilled ? total / projectsBilled : 0,
    };
  }, [paidSales]);

  // Evolução mensal do faturamento (soma vendas pagas por mês)
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    const cur = new Date(from);
    cur.setDate(1);
    while (cur <= to) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, 0);
      cur.setMonth(cur.getMonth() + 1);
    }
    paidSales.forEach((s) => {
      const key = s.data.slice(0, 7);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + Number(s.valor));
    });
    return Array.from(map.entries()).map(([k, v]) => {
      const [y, mo] = k.split("-");
      const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("pt-BR", {
        month: "short",
      });
      return { mes: label.replace(".", ""), receita: v };
    });
  }, [paidSales, from, to]);

  // Ticket médio por serviço
  const byService = useMemo(() => {
    const serviceOf = new Map(projects.map((p) => [p.id, p.servico]));
    const acc = new Map<string, { total: number; projects: Set<string> }>();
    paidSales.forEach((s) => {
      const key = serviceOf.get(s.project_id) ?? "";
      const cur = acc.get(key) ?? { total: 0, projects: new Set<string>() };
      cur.total += Number(s.valor);
      cur.projects.add(s.project_id);
      acc.set(key, cur);
    });
    const rows: {
      key: string;
      label: string;
      value: number;
      hint: string;
      muted: boolean;
    }[] = PROJECT_SERVICES.map((sv) => {
      const a = acc.get(sv.value);
      return {
        key: sv.value,
        label: sv.label,
        value: a ? a.total / a.projects.size : 0,
        hint: a
          ? `${a.projects.size} ${a.projects.size === 1 ? "projeto" : "projetos"}`
          : "sem vendas",
        muted: false,
      };
    });
    const none = acc.get("");
    if (none) {
      rows.push({
        key: "none",
        label: "Serviço não definido",
        value: none.total / none.projects.size,
        hint: `${none.projects.size} ${none.projects.size === 1 ? "projeto" : "projetos"} · defina em Projetos`,
        muted: true,
      });
    }
    return rows;
  }, [paidSales, projects]);

  // Distribuição por projeto
  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    paidSales.forEach((s) => {
      map.set(s.project_id, (map.get(s.project_id) ?? 0) + Number(s.valor));
    });
    return Array.from(map.entries())
      .map(([pid, valor]) => ({
        name: projects.find((p) => p.id === pid)?.nome ?? "Projeto",
        value: valor,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [paidSales, projects]);

  // Status dos projetos
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => map.set(p.status, (map.get(p.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([status, count]) => ({
      status: STATUS_LABELS[status] ?? status,
      count,
    }));
  }, [projects]);

  // Desempenho por colaborador
  const byCollab = useMemo(() => {
    const stepsBy = new Map<string, number>();
    steps.forEach((s) => {
      if (s.status !== "concluido" || !s.autor_id) return;
      stepsBy.set(s.autor_id, (stepsBy.get(s.autor_id) ?? 0) + 1);
    });
    const activeProjectIds = new Set(
      projects.filter((p) => p.status !== "concluido" && p.status !== "pausado").map((p) => p.id),
    );
    const projBy = new Map<string, number>();
    members.forEach((m) => {
      if (!activeProjectIds.has(m.project_id)) return;
      projBy.set(m.user_id, (projBy.get(m.user_id) ?? 0) + 1);
    });
    const userIds = new Set<string>([...stepsBy.keys(), ...projBy.keys()]);
    return Array.from(userIds)
      .map((uid) => {
        const p = profiles.find((x) => x.id === uid);
        const nome = p?.nome ?? p?.email ?? "—";
        return {
          nome: nome.split(" ")[0],
          etapas: stepsBy.get(uid) ?? 0,
          projetos: projBy.get(uid) ?? 0,
        };
      })
      .sort((a, b) => b.etapas + b.projetos - (a.etapas + a.projetos))
      .slice(0, 10);
  }, [steps, members, projects, profiles]);

  // Indicadores comerciais (leads do Banco de Leads / Kanban, conforme o RLS de cada um)
  const salesKpis = useMemo(() => {
    if (!commercial) return null;
    const leads = commercial.leads;
    const open = leads.filter((l) => !isFinalStage(l.etapa));
    const opportunities = open.filter((l) => OPPORTUNITY_STAGES.includes(l.etapa));
    const negotiating = open.filter((l) => NEGOTIATION_STAGES.includes(l.etapa));
    const nowISO = new Date().toISOString();
    const upcoming = open.filter(
      (l) =>
        l.etapa === "reuniao" &&
        (l.reuniao_status === "agendada" || l.reuniao_status === "reagendada") &&
        !!l.reuniao_em &&
        l.reuniao_em >= nowISO,
    ).length;
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    // Distribuição de todos os leads pelas colunas do Kanban (abertos e encerrados)
    const pipeline = BOARD_COLUMNS.map((col) => {
      const rows = leads.filter((l) => (col.stages as string[]).includes(l.etapa));
      const breakdown =
        col.stages.length > 1
          ? col.stages
              .map((st) => ({ st, n: rows.filter((l) => l.etapa === st).length }))
              .filter((b) => b.n > 0)
              .map((b) => `${stageLabel(b.st)}: ${fmtInt(b.n)}`)
              .join(" · ")
          : "";
      return {
        key: col.key,
        label: col.label,
        count: rows.length,
        pct: leads.length ? (rows.length / leads.length) * 100 : 0,
        value: rows.reduce((a, l) => a + leadValue(l), 0),
        breakdown,
        color: PIPELINE_COLORS[col.key] ?? ACCENT,
      };
    }).filter((r) => r.count > 0);
    return {
      total: leads.length,
      newInPeriod: leads.filter((l) => l.created_at >= fromISO && l.created_at <= toISO).length,
      open: open.length,
      opportunities: opportunities.length,
      opportunitiesValue: opportunities.reduce((a, l) => a + leadValue(l), 0),
      negotiationValue: negotiating.reduce((a, l) => a + leadValue(l), 0),
      negotiationCount: negotiating.length,
      meetings: commercial.meetingsBooked,
      upcoming,
      pipeline,
    };
  }, [commercial, from, to]);

  // Leads abertos (cadastrados) por semana, semanas começando na segunda-feira
  const weekly = useMemo(() => {
    if (!commercial) return [];
    const weeks = new Map<string, number>();
    const cur = startOfWeek(from, { weekStartsOn: 1 });
    while (cur <= to) {
      weeks.set(format(cur, "yyyy-MM-dd"), 0);
      cur.setDate(cur.getDate() + 7);
    }
    commercial.leads.forEach((l) => {
      const d = new Date(l.created_at);
      if (d < from || d > to) return;
      const key = weekKey(d);
      if (weeks.has(key)) weeks.set(key, (weeks.get(key) ?? 0) + 1);
    });
    return Array.from(weeks.entries()).map(([k, leads]) => ({
      semana: format(new Date(k + "T12:00:00"), "dd/MM"),
      leads,
    }));
  }, [commercial, from, to]);

  const weeklyEmpty = weekly.every((w) => w.leads === 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Insights</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasCommercial
              ? "Indicadores comerciais, faturamento, equipe e projetos."
              : "Visão consolidada de faturamento, equipe e projetos."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="ano">Últimos 12 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div>
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: hasCommercial ? 8 : 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <section className="space-y-3" aria-label="Indicadores">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Faturamento no período"
                value={fmtBRL(revenue.total)}
                hint={`${fmtInt(revenue.count)} ${revenue.count === 1 ? "venda" : "vendas"}`}
              />
              <Kpi
                label="Ticket médio"
                value={revenue.projectsBilled ? fmtBRL(revenue.ticket) : "—"}
                hint={`por projeto faturado · ${fmtInt(revenue.projectsBilled)} ${revenue.projectsBilled === 1 ? "projeto" : "projetos"}`}
              />
              {!salesKpis && (
                <>
                  <Kpi
                    label="Vendas no período"
                    value={fmtInt(revenue.count)}
                    hint="sem canceladas"
                  />
                  <Kpi
                    label="Projetos faturados"
                    value={fmtInt(revenue.projectsBilled)}
                    hint="com venda no período"
                  />
                </>
              )}
              {salesKpis && (
                <>
                  <Kpi
                    label="Em negociação"
                    value={fmtBRL(salesKpis.negotiationValue)}
                    hint={`${fmtInt(salesKpis.negotiationCount)} em proposta, negociação ou contrato`}
                  />
                  <Kpi
                    label="Oportunidades ativas"
                    value={fmtInt(salesKpis.opportunities)}
                    hint={`${fmtBRL(salesKpis.opportunitiesValue)} · da reunião ao contrato`}
                  />
                </>
              )}
            </div>
            {salesKpis && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  label="Leads no Banco de Leads"
                  value={fmtInt(salesKpis.total)}
                  hint={`+${fmtInt(salesKpis.newInPeriod)} no período`}
                />
                <Kpi
                  label="Leads em aberto"
                  value={fmtInt(salesKpis.open)}
                  hint="ainda sem ganho ou encerramento"
                />
                <Kpi
                  label="Reuniões marcadas"
                  value={salesKpis.meetings == null ? "—" : fmtInt(salesKpis.meetings)}
                  hint={`no período · ${fmtInt(salesKpis.upcoming)} ${salesKpis.upcoming === 1 ? "agendada" : "agendadas"} a seguir`}
                />
                <Kpi
                  label="Projetos faturados"
                  value={fmtInt(revenue.projectsBilled)}
                  hint="com venda no período"
                />
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-border/50 bg-card/50 md:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <TrendingUp className="size-4 text-primary" />
                <CardTitle className="text-sm font-medium">Faturamento por mês</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {monthly.every((m) => m.receita === 0) ? (
                  <EmptyState label="Sem receita no período selecionado." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#057ef3" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#057ef3" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="mes" stroke={AXIS} fontSize={11} />
                      <YAxis
                        stroke={AXIS}
                        fontSize={11}
                        width={72}
                        tickFormatter={(v) => fmtBRLCompact(v)}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL}
                        itemStyle={TOOLTIP_ITEM}
                        formatter={(v: number) => [fmtBRL(v), "Faturamento"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="receita"
                        stroke="#057ef3"
                        strokeWidth={2}
                        fill="url(#rev)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {salesKpis && (
              <Card className="rounded-2xl border-border/50 bg-card/50">
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Filter className="size-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Pipeline de vendas</CardTitle>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    % dos leads por etapa
                  </span>
                </CardHeader>
                <CardContent>
                  {salesKpis.total === 0 ? (
                    <div className="h-64">
                      <EmptyState label="Nenhum lead registrado no Kanban." />
                    </div>
                  ) : (
                    <PipelinePie rows={salesKpis.pipeline} total={salesKpis.total} />
                  )}
                </CardContent>
              </Card>
            )}

            <Card
              className={`rounded-2xl border-border/50 bg-card/50 ${salesKpis ? "" : "md:col-span-2"}`}
            >
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Layers className="size-4 text-primary" />
                <CardTitle className="text-sm font-medium">Ticket médio por serviço</CardTitle>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  por projeto faturado
                </span>
              </CardHeader>
              <CardContent>
                {byService.every((r) => r.value === 0) ? (
                  <div className="h-64">
                    <EmptyState label="Sem vendas no período. Defina o serviço de cada projeto em Projetos." />
                  </div>
                ) : (
                  <HBarList
                    rows={byService.map((r) => ({
                      key: r.key,
                      label: r.label,
                      size: r.value,
                      value: r.value ? fmtBRL(r.value) : "—",
                      hint: r.hint,
                      muted: r.muted,
                      title: `${r.label}: ${r.value ? fmtBRL(r.value) : "sem vendas"} (${r.hint})`,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            {salesKpis && (
              <Card className="rounded-2xl border-border/50 bg-card/50 md:col-span-2">
                <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-2">
                  <CalendarRange className="size-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Leads abertos por semana</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  {weeklyEmpty ? (
                    <EmptyState label="Nenhum lead registrado no período." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={weekly}
                        margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis dataKey="semana" stroke={AXIS} fontSize={11} minTickGap={12} />
                        <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelStyle={TOOLTIP_LABEL}
                          itemStyle={TOOLTIP_ITEM}
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          labelFormatter={(l) => `Semana de ${l}`}
                        />
                        <Bar
                          dataKey="leads"
                          name="Leads cadastrados"
                          fill={ACCENT}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-border/50 bg-card/50">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <PieIcon className="size-4 text-primary" />
                <CardTitle className="text-sm font-medium">Receita por projeto</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {byProject.length === 0 ? (
                  <EmptyState label="Nenhuma venda para distribuir." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byProject}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {byProject.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL}
                        itemStyle={TOOLTIP_ITEM}
                        formatter={(v: number) => fmtBRL(v)}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card/50">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Activity className="size-4 text-primary" />
                <CardTitle className="text-sm font-medium">Status dos projetos</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {byStatus.length === 0 ? (
                  <EmptyState label="Nenhum projeto cadastrado." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byStatus} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="status" stroke={AXIS} fontSize={11} />
                      <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL}
                        itemStyle={TOOLTIP_ITEM}
                      />
                      <Bar
                        dataKey="count"
                        name="Projetos"
                        fill="#057ef3"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card/50 md:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Users className="size-4 text-primary" />
                <CardTitle className="text-sm font-medium">Desempenho por colaborador</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {byCollab.length === 0 ? (
                  <EmptyState label="Sem atividade da equipe no período." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCollab} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="nome" stroke={AXIS} fontSize={11} />
                      <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL}
                        itemStyle={TOOLTIP_ITEM}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="etapas"
                        name="Etapas concluídas"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      />
                      <Bar
                        dataKey="projetos"
                        name="Projetos ativos"
                        fill="#057ef3"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold" title={value}>
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

type PipelineSlice = {
  key: string;
  label: string;
  count: number;
  pct: number;
  value: number;
  breakdown: string;
  color: string;
};

function fmtPct(v: number) {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/**
 * Pizza com a fatia de leads em cada etapa do Kanban, na ordem do funil, e a
 * legenda ao lado com o percentual e a quantidade de cada etapa.
 */
function PipelinePie({ rows, total }: { rows: PipelineSlice[]; total: number }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-56 w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              innerRadius="55%"
              outerRadius="95%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL}
              itemStyle={TOOLTIP_ITEM}
              formatter={(v: number, _name, item) => {
                const r = item.payload as PipelineSlice;
                return [
                  `${fmtInt(v)} ${v === 1 ? "lead" : "leads"} · ${fmtPct(r.pct)} · ${fmtBRL(r.value)}`,
                  r.label,
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{fmtInt(total)}</span>
          <span className="text-[11px] text-muted-foreground">leads</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 sm:w-1/2">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex items-center gap-2 text-xs"
            title={`${r.label}: ${fmtInt(r.count)} leads (${fmtPct(r.pct)})${
              r.breakdown ? ` — ${r.breakdown}` : ""
            }`}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="truncate text-foreground/90">{r.label}</span>
            <span className="ml-auto shrink-0 tabular-nums text-foreground/90">
              {fmtPct(r.pct)}
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
              {fmtInt(r.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Barras horizontais de um único tom, com o valor escrito ao lado (a cor não
 * carrega informação; "muted" marca o que precisa de atenção, como serviço
 * não definido).
 */
function HBarList({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    size: number;
    value: string;
    hint?: string;
    title?: string;
    muted?: boolean;
  }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.size));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} title={r.title}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-foreground/90">
              {r.label}
              {r.hint && <span className="text-muted-foreground"> · {r.hint}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full"
              style={{
                width: `${r.size === 0 ? 0 : Math.max(2, (r.size / max) * 100)}%`,
                backgroundColor: r.muted ? "rgba(255,255,255,0.28)" : ACCENT,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
