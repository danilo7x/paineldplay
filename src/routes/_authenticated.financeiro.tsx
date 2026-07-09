import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
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
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  Target,
  Tag,
  Repeat,
  StopCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: ({ context }) => {
    if (!context.isFinance) throw redirect({ to: "/dashboard" });
  },
  component: FinanceiroPage,
});

type Expense = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  project_id: string | null;
  recorrente?: boolean | null;
  recorrencia?: string | null;
  dia_cobranca?: number | null;
  recorrencia_ate?: string | null;
  origem_id?: string | null;
};
type Sale = { id: string; valor: number; data: string; status: string; project_id: string };
type ProjectLite = { id: string; nome: string };
type Category = { id: string; slug: string; nome: string; cor: string };
type Goal = { id: string; mes: string; receita_meta: number; lucro_meta: number };

const FALLBACK_COLOR = "#64748B";

const brl = (n: number) => {
  const abs = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Math.abs(n),
  );
  return n < 0 ? `-${abs}` : abs;
};

const TAX_RATE = 0.06;
const RESERVE_RATE = 0.15;

type PresetKey = "mes" | "anterior" | "ano" | "custom";

function presetRange(preset: PresetKey): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "mes") {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (preset === "anterior") {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === "ano") {
    return {
      from: iso(new Date(now.getFullYear(), 0, 1)),
      to: iso(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
}

function FinanceiroPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetKey>("mes");
  const [range, setRange] = useState(() => presetRange("mes"));
  const [categoria, setCategoria] = useState<string>("todas");
  const [projeto, setProjeto] = useState<string>("todos");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [openCats, setOpenCats] = useState(false);
  const [openGoals, setOpenGoals] = useState(false);

  async function fetchAll() {
    setLoading(true);
    // Gera ocorrências pendentes antes de carregar (idempotente).
    await supabase.rpc("generate_recurrences");
    const [expRes, salesRes, projRes, catRes, goalRes] = await Promise.all([
      supabase.from("expenses").select("*").order("data", { ascending: false }),
      supabase.from("sales").select("id, valor, data, status, project_id"),
      supabase.from("projects").select("id, nome").order("nome"),
      supabase.from("expense_categories").select("*").order("nome"),
      supabase.from("financial_goals").select("*").order("mes", { ascending: false }),
    ]);
    if (expRes.error) toast.error("Erro nas despesas", { description: expRes.error.message });
    setExpenses((expRes.data ?? []) as Expense[]);
    setSales((salesRes.data ?? []) as Sale[]);
    setProjects((projRes.data ?? []) as ProjectLite[]);
    setCategories((catRes.data ?? []) as Category[]);
    setGoals((goalRes.data ?? []) as Goal[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const applyPreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const inRange = <T extends { data: string }>(row: T) =>
    row.data >= range.from && row.data <= range.to;

  // Sales só sofrem filtro por projeto (não têm categoria).
  const filteredSales = sales.filter((s) => {
    if (s.status === "cancelado") return false;
    if (!inRange(s)) return false;
    if (projeto !== "todos" && s.project_id !== projeto) return false;
    return true;
  });
  const filteredExpenses = expenses.filter((e) => {
    if (!inRange(e)) return false;
    if (categoria !== "todas" && e.categoria !== categoria) return false;
    if (projeto !== "todos" && e.project_id !== projeto) return false;
    return true;
  });
  const receitaTotal = filteredSales.reduce((a, s) => a + Number(s.valor), 0);
  const despesaTotalPeriodo = filteredExpenses.reduce((a, e) => a + Number(e.valor), 0);
  const lucro = receitaTotal - despesaTotalPeriodo;
  const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0;

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.nome));
    return m;
  }, [projects]);

  const catBySlug = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.slug, c));
    return m;
  }, [categories]);

  // Meta do mês em foco (usa o mês do "de" do intervalo).
  const goalMonth = useMemo(() => range.from.slice(0, 7) + "-01", [range.from]);
  const currentGoal = useMemo(
    () => goals.find((g) => g.mes.slice(0, 10) === goalMonth) ?? null,
    [goals, goalMonth],
  );
  const goalReceitaPct = currentGoal && Number(currentGoal.receita_meta) > 0
    ? Math.min(100, (receitaTotal / Number(currentGoal.receita_meta)) * 100)
    : 0;
  const goalLucroPct = currentGoal && Number(currentGoal.lucro_meta) > 0
    ? Math.min(100, (lucro / Number(currentGoal.lucro_meta)) * 100)
    : 0;

  const monthlySeries = useMemo(() => {
    const fromDate = new Date(range.from + "T00:00:00");
    const toDate = new Date(range.to + "T00:00:00");
    const buckets: { key: string; label: string; receita: number; despesa: number }[] = [];
    const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    while (cur <= toDate) {
      buckets.push({
        key: cur.toISOString().slice(0, 7),
        label: cur.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        receita: 0,
        despesa: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    const map = new Map(buckets.map((b) => [b.key, b] as const));
    filteredSales.forEach((s) => {
      const b = map.get(s.data.slice(0, 7));
      if (b) b.receita += Number(s.valor);
    });
    filteredExpenses.forEach((e) => {
      const b = map.get(e.data.slice(0, 7));
      if (b) b.despesa += Number(e.valor);
    });
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, expenses, range, categoria, projeto]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    const source = expenses.filter((e) => {
      if (!inRange(e)) return false;
      if (projeto !== "todos" && e.project_id !== projeto) return false;
      return true;
    });
    source.forEach((e) => {
      m.set(e.categoria, (m.get(e.categoria) ?? 0) + Number(e.valor));
    });
    return Array.from(m.entries())
      .map(([key, value]) => ({
        key,
        label: catBySlug.get(key)?.nome ?? key,
        cor: catBySlug.get(key)?.cor ?? FALLBACK_COLOR,
        value,
      }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, range, projeto, catBySlug]);

  async function deleteExpense(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error("Não foi possível excluir", { description: error.message });
    toast.success("Despesa excluída");
    fetchAll();
  }

  async function encerrarRecorrencia(exp: Expense) {
    if (!confirm(`Encerrar a recorrência de "${exp.descricao}"? Novas ocorrências deixam de ser geradas.`))
      return;
    const templateId = exp.origem_id ?? exp.id;
    const { error } = await supabase
      .from("expenses")
      .update({ recorrencia_ate: new Date().toISOString().slice(0, 10) })
      .eq("id", templateId);
    if (error) return toast.error("Erro ao encerrar", { description: error.message });
    toast.success("Recorrência encerrada");
    fetchAll();
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Administração</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão global de receitas e despesas da empresa.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Nova despesa
            </Button>
          </DialogTrigger>
          <ExpenseDialog
            projects={projects}
            categories={categories}
            onSaved={() => {
              setOpenNew(false);
              fetchAll();
            }}
          />
        </Dialog>
      </header>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card/60 p-1">
            {(
              [
                { k: "mes", l: "Este mês" },
                { k: "anterior", l: "Mês anterior" },
                { k: "ano", l: "Este ano" },
                { k: "custom", l: "Personalizado" },
              ] as { k: PresetKey; l: string }[]
            ).map((p) => (
              <button
                key={p.k}
                onClick={() => applyPreset(p.k)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  preset === p.k
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.l}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="h-9 w-[150px]"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="h-9 w-[150px]"
              />
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenCats(true)}>
              <Tag className="size-3.5" /> Categorias
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenGoals(true)}>
              <Target className="size-3.5" /> Metas
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <SummaryCard
          label="Receita"
          value={brl(receitaTotal)}
          icon={Wallet}
          hint="Vendas do período"
        />
        <SummaryCard
          label="Despesa"
          value={brl(despesaTotalPeriodo)}
          icon={ArrowDownRight}
          hint={`${filteredExpenses.length} lançamento${filteredExpenses.length === 1 ? "" : "s"}`}
          accent="text-rose-300"
        />
        <SummaryCard
          label="Lucro"
          value={brl(lucro)}
          icon={lucro >= 0 ? ArrowUpRight : ArrowDownRight}
          hint={lucro >= 0 ? "Positivo" : "Negativo"}
          accent={lucro >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <SummaryCard
          label="Margem"
          value={`${margem.toFixed(1)}%`}
          icon={TrendingUp}
          hint={receitaTotal > 0 ? "Lucro / receita" : "Sem receita"}
          accent={margem >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
      </div>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Reservas sobre a receita
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Provisões de imposto e caixa
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cálculo automático a partir da receita bruta do período selecionado.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Sobra líquida sugerida</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-300">
                {brl(receitaTotal * (1 - TAX_RATE - RESERVE_RATE))}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200/80">
                Imposto ({(TAX_RATE * 100).toFixed(0)}%)
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-amber-200">
                {brl(receitaTotal * TAX_RATE)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Provisão para tributos.</p>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-sky-200/80">
                Reserva de caixa ({(RESERVE_RATE * 100).toFixed(0)}%)
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-sky-200">
                {brl(receitaTotal * RESERVE_RATE)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Fundo estratégico da operação.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Metas de {new Date(goalMonth + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Realizado x meta</h2>
            </div>
            {!currentGoal && (
              <Button size="sm" variant="outline" onClick={() => setOpenGoals(true)} className="gap-1.5">
                <Target className="size-3.5" /> Definir meta deste mês
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <GoalRow label="Receita" real={receitaTotal} meta={Number(currentGoal?.receita_meta ?? 0)} pct={goalReceitaPct} accent="text-primary" barClass="bg-primary" />
            <GoalRow label="Lucro" real={lucro} meta={Number(currentGoal?.lucro_meta ?? 0)} pct={goalLucroPct} accent={lucro >= 0 ? "text-emerald-300" : "text-rose-300"} barClass="bg-emerald-400" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl lg:col-span-2">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Receita x Despesa
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Comparativo mensal</h2>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
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
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(11,15,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#fff",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(v: number) => brl(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
                  <Bar dataKey="receita" name="Receita" fill="#057EF3" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#F43F5E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Despesas
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Por categoria</h2>
            {byCategory.length === 0 ? (
              <div className="mt-8 text-center text-xs text-muted-foreground">
                Sem despesas no período.
              </div>
            ) : (
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {byCategory.map((entry, i) => (
                        <Cell
                          key={entry.key}
                          fill={entry.cor}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(11,15,26,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "#fff",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(v: number) => brl(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-lg font-semibold tracking-tight">Despesas</h2>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-9 w-[180px] rounded-full">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projeto} onValueChange={setProjeto}>
              <SelectTrigger className="h-9 w-[200px] rounded-full">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os projetos</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma despesa neste filtro.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e) => (
                    <TableRow key={e.id} className="border-border/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{e.descricao}</span>
                          {(e.recorrente || e.origem_id) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20">
                              <Repeat className="size-3" /> Recorrente
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge cat={catBySlug.get(e.categoria)} slug={e.categoria} />
                      </TableCell>
                      <TableCell className="font-medium text-rose-300">
                        {brl(Number(e.valor))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.project_id ? projectMap.get(e.project_id) ?? "—" : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {(e.recorrente || e.origem_id) && !e.recorrencia_ate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-amber-300 hover:text-amber-200"
                              title="Encerrar recorrência"
                              onClick={() => encerrarRecorrencia(e)}
                            >
                              <StopCircle className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditing(e)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-rose-300 hover:text-rose-200"
                            onClick={() => deleteExpense(e.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <ExpenseDialog
            projects={projects}
            categories={categories}
            expense={editing}
            onSaved={() => {
              setEditing(null);
              fetchAll();
            }}
          />
        )}
      </Dialog>

      <Dialog open={openCats} onOpenChange={setOpenCats}>
        <CategoriesDialog categories={categories} onSaved={fetchAll} />
      </Dialog>
      <Dialog open={openGoals} onOpenChange={setOpenGoals}>
        <GoalsDialog goals={goals} defaultMonth={goalMonth} onSaved={fetchAll} />
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
            <Icon className="size-4" />
          </div>
        </div>
        <p
          className={cn(
            "mt-3 w-full whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
            accent,
          )}
        >
          {value}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({
  projects,
  categories,
  expense,
  onSaved,
}: {
  projects: ProjectLite[];
  categories: Category[];
  expense?: Expense;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState(expense?.descricao ?? "");
  const [categoria, setCategoria] = useState(
    expense?.categoria ?? categories[0]?.slug ?? "outros",
  );
  const [valor, setValor] = useState(expense ? String(expense.valor) : "");
  const [data, setData] = useState(expense?.data ?? new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState<string>(expense?.project_id ?? "none");
  const [loading, setLoading] = useState(false);
  const isChild = !!expense?.origem_id;
  const [recorrente, setRecorrente] = useState<boolean>(!!expense?.recorrente);
  const [recorrencia, setRecorrencia] = useState<"mensal" | "anual">(
    (expense?.recorrencia as "mensal" | "anual") ?? "mensal",
  );
  const [diaCobranca, setDiaCobranca] = useState<string>(
    expense?.dia_cobranca ? String(expense.dia_cobranca) : "",
  );
  const [recorrenciaAte, setRecorrenciaAte] = useState<string>(expense?.recorrencia_ate ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const dia = diaCobranca ? Math.min(31, Math.max(1, Number(diaCobranca))) : null;
    const payload = {
      descricao,
      categoria,
      valor: Number(valor.replace(",", ".")) || 0,
      data,
      project_id: projectId === "none" ? null : projectId,
      recorrente,
      recorrencia: recorrente ? recorrencia : null,
      dia_cobranca: recorrente
        ? (dia ?? Number(new Date(data + "T00:00:00").getDate()))
        : null,
      recorrencia_ate: recorrente ? (recorrenciaAte || null) : null,
    };
    const res = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase
          .from("expenses")
          .insert({ ...payload, created_by: sess.session?.user.id });
    if (!res.error) {
      // Se marcada como recorrente, gera as ocorrências passadas até hoje.
      if (recorrente) await supabase.rpc("generate_recurrences");
    }
    setLoading(false);
    if (res.error) return toast.error("Não foi possível salvar", { description: res.error.message });
    toast.success(expense ? "Despesa atualizada" : "Despesa registrada");
    onSaved();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="e-desc">Descrição</Label>
          <Input
            id="e-desc"
            value={descricao}
            onChange={(ev) => setDescricao(ev.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: c.cor }} />
                      {c.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-valor">Valor (R$)</Label>
            <Input
              id="e-valor"
              inputMode="decimal"
              value={valor}
              onChange={(ev) => setValor(ev.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-data">Data</Label>
            <Input
              id="e-data"
              type="date"
              value={data}
              onChange={(ev) => setData(ev.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem projeto</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isChild ? (
          <div className="rounded-xl border border-border/50 bg-primary/5 p-3 text-xs text-muted-foreground">
            Esta linha foi gerada automaticamente por uma despesa recorrente. Para alterar a recorrência edite a despesa de origem.
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Despesa recorrente</p>
                <p className="text-[11px] text-muted-foreground">
                  Gera as ocorrências automaticamente todos os meses/anos.
                </p>
              </div>
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
            </div>
            {recorrente && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Frequência</Label>
                  <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as "mensal" | "anual")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-dia">Dia da cobrança</Label>
                  <Input
                    id="e-dia"
                    type="number"
                    min={1}
                    max={31}
                    value={diaCobranca}
                    onChange={(ev) => setDiaCobranca(ev.target.value)}
                    placeholder={String(new Date(data + "T00:00:00").getDate())}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-ate">Até (opcional)</Label>
                  <Input
                    id="e-ate"
                    type="date"
                    value={recorrenciaAte}
                    onChange={(ev) => setRecorrenciaAte(ev.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {expense ? "Salvar alterações" : "Registrar despesa"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function CategoryBadge({ cat, slug }: { cat: Category | undefined; slug: string }) {
  const cor = cat?.cor ?? FALLBACK_COLOR;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
      style={{
        background: `${cor}22`,
        color: cor,
        boxShadow: `inset 0 0 0 1px ${cor}55`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: cor }} />
      {cat?.nome ?? slug}
    </span>
  );
}

function GoalRow({
  label,
  real,
  meta,
  pct,
  accent,
  barClass,
}: {
  label: string;
  real: number;
  meta: number;
  pct: number;
  accent?: string;
  barClass?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-semibold", accent)}>{brl(real)}</span>
      </div>
      <Progress value={pct} className={cn("h-2", barClass && `[&>div]:${barClass}`)} />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Meta: {meta > 0 ? brl(meta) : "—"}</span>
        <span>{meta > 0 ? `${pct.toFixed(0)}%` : "sem meta"}</span>
      </div>
    </div>
  );
}

function CategoriesDialog({
  categories,
  onSaved,
}: {
  categories: Category[];
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#057EF3");
  const [saving, setSaving] = useState(false);

  function slugify(s: string) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `cat_${Date.now()}`;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("expense_categories").insert({
      slug: slugify(nome),
      nome: nome.trim(),
      cor,
      created_by: sess.session?.user.id,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao criar", { description: error.message });
    toast.success("Categoria criada");
    setNome("");
    setCor("#057EF3");
    onSaved();
  }

  async function updateCor(id: string, novaCor: string) {
    const { error } = await supabase.from("expense_categories").update({ cor: novaCor }).eq("id", id);
    if (error) return toast.error("Erro ao salvar cor", { description: error.message });
    onSaved();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta categoria? Despesas existentes manterão o rótulo pelo slug.")) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Categoria removida");
    onSaved();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Categorias de despesa</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-xl border border-border/50">
          {categories.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <input
                    type="color"
                    value={c.cor}
                    onChange={(e) => updateCor(c.id, e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border/50 bg-transparent"
                    aria-label={`Cor de ${c.nome}`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{c.slug}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-rose-300 hover:text-rose-200"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form onSubmit={add} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="c-nome">Nova categoria</Label>
            <Input
              id="c-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Assinaturas"
            />
          </div>
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded border border-border/50 bg-transparent"
            aria-label="Cor da nova categoria"
          />
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar
          </Button>
        </form>
      </div>
    </DialogContent>
  );
}

function GoalsDialog({
  goals,
  defaultMonth,
  onSaved,
}: {
  goals: Goal[];
  defaultMonth: string;
  onSaved: () => void;
}) {
  const [mes, setMes] = useState(defaultMonth.slice(0, 7));
  const existing = useMemo(
    () => goals.find((g) => g.mes.slice(0, 7) === mes) ?? null,
    [goals, mes],
  );
  const [receita, setReceita] = useState("");
  const [lucro, setLucro] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReceita(existing ? String(existing.receita_meta) : "");
    setLucro(existing ? String(existing.lucro_meta) : "");
  }, [existing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const payload = {
      mes: `${mes}-01`,
      receita_meta: Number(receita.replace(",", ".")) || 0,
      lucro_meta: Number(lucro.replace(",", ".")) || 0,
    };
    const res = existing
      ? await supabase.from("financial_goals").update(payload).eq("id", existing.id)
      : await supabase
          .from("financial_goals")
          .insert({ ...payload, created_by: sess.session?.user.id });
    setSaving(false);
    if (res.error) return toast.error("Erro ao salvar meta", { description: res.error.message });
    toast.success("Meta salva");
    onSaved();
  }

  async function remove() {
    if (!existing) return;
    if (!confirm("Remover a meta deste mês?")) return;
    const { error } = await supabase.from("financial_goals").delete().eq("id", existing.id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Meta removida");
    onSaved();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Metas mensais</DialogTitle>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="g-mes">Mês</Label>
          <Input
            id="g-mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-rec">Receita meta (R$)</Label>
            <Input
              id="g-rec"
              inputMode="decimal"
              value={receita}
              onChange={(e) => setReceita(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-luc">Lucro meta (R$)</Label>
            <Input
              id="g-luc"
              inputMode="decimal"
              value={lucro}
              onChange={(e) => setLucro(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {existing ? (
            <Button type="button" variant="ghost" onClick={remove} className="text-rose-300">
              Remover meta
            </Button>
          ) : <span />}
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {existing ? "Atualizar" : "Definir meta"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
