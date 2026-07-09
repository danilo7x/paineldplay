import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, Users, PieChart as PieIcon, Activity } from "lucide-react";
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

type Sale = { valor: number; data: string; project_id: string; status: string };
type Project = { id: string; nome: string; status: string };
type Step = { autor_id: string | null; status: string; updated_at: string };
type Member = { user_id: string; project_id: string };
type Profile = { id: string; nome: string | null; email: string | null };

const PALETTE = ["#057ef3", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

const STATUS_LABELS: Record<string, string> = {
  em_desenvolvimento: "Em desenvolvimento",
  em_manutencao: "Em manutenção",
  concluido: "Concluído",
  pausado: "Pausado",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const fromISO = toISODate(from);
      const toISO = toISODate(to);
      const toExclusive = addDays(toISO, 1); // inclusive .lt() next day
      const [s, p, st, m, pr] = await Promise.all([
        supabase
          .from("sales")
          .select("valor, data, project_id, status")
          .gte("data", fromISO)
          .lt("data", toExclusive),
        supabase.from("projects").select("id, nome, status"),
        supabase
          .from("project_steps")
          .select("autor_id, status, updated_at")
          .gte("updated_at", from.toISOString())
          .lte("updated_at", to.toISOString()),
        supabase.from("project_members").select("user_id, project_id"),
        supabase.from("profiles").select("id, nome, email"),
      ]);
      if (cancelled) return;
      setSales((s.data ?? []) as Sale[]);
      setProjects((p.data ?? []) as Project[]);
      setSteps((st.data ?? []) as Step[]);
      setMembers((m.data ?? []) as Member[]);
      setProfiles((pr.data ?? []) as Profile[]);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

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
    sales.forEach((s) => {
      if (s.status === "cancelado") return;
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
  }, [sales, from, to]);

  // Distribuição por projeto
  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      if (s.status === "cancelado") return;
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
  }, [sales, projects]);

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Insights</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada de faturamento, equipe e projetos.
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
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
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
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/50 bg-card/50 md:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <TrendingUp className="size-4 text-primary" />
              <CardTitle className="text-sm font-medium">Evolução do faturamento</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {monthly.every((m) => m.receita === 0) ? (
                <EmptyState label="Sem receita no período selecionado." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#057ef3" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#057ef3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="mes" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} tickFormatter={(v) => fmtBRL(v)} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM}
                      formatter={(v: number) => fmtBRL(v)}
                    />
                    <Area type="monotone" dataKey="receita" stroke="#057ef3" strokeWidth={2} fill="url(#rev)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

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
                    <Pie data={byProject} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {byProject.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="status" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
                    <Bar dataKey="count" fill="#057ef3" radius={[6, 6, 0, 0]} />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="nome" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="etapas" name="Etapas concluídas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="projetos" name="Projetos ativos" fill="#057ef3" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}

// Silence unused-import warnings when charts render empty
void Loader2;