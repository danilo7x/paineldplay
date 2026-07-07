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

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard" });
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
};
type Sale = { id: string; valor: number; data: string; status: string; project_id: string };
type ProjectLite = { id: string; nome: string };

const CATEGORIES = [
  { value: "ferramentas", label: "Ferramentas" },
  { value: "marketing", label: "Marketing" },
  { value: "impostos", label: "Impostos" },
  { value: "salarios", label: "Salários" },
  { value: "infra", label: "Infraestrutura" },
  { value: "outros", label: "Outros" },
];
const CATEGORY_COLORS = ["#057EF3", "#31B7FF", "#8B5CF6", "#F59E0B", "#10B981", "#F43F5E"];
const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

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
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetKey>("mes");
  const [range, setRange] = useState(() => presetRange("mes"));
  const [categoria, setCategoria] = useState<string>("todas");
  const [projeto, setProjeto] = useState<string>("todos");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function fetchAll() {
    setLoading(true);
    const [expRes, salesRes, projRes] = await Promise.all([
      supabase.from("expenses").select("*").order("data", { ascending: false }),
      supabase.from("sales").select("id, valor, data, status, project_id"),
      supabase.from("projects").select("id, nome").order("nome"),
    ]);
    if (expRes.error) toast.error("Erro nas despesas", { description: expRes.error.message });
    setExpenses((expRes.data ?? []) as Expense[]);
    setSales((salesRes.data ?? []) as Sale[]);
    setProjects((projRes.data ?? []) as ProjectLite[]);
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

  const receitaTotal = sales
    .filter((s) => s.status !== "cancelado" && inRange(s))
    .reduce((a, s) => a + Number(s.valor), 0);
  const filteredExpenses = expenses.filter((e) => {
    if (!inRange(e)) return false;
    if (categoria !== "todas" && e.categoria !== categoria) return false;
    if (projeto !== "todos" && e.project_id !== projeto) return false;
    return true;
  });
  const despesaTotalPeriodo = expenses.filter(inRange).reduce((a, e) => a + Number(e.valor), 0);
  const lucro = receitaTotal - despesaTotalPeriodo;
  const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0;

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.nome));
    return m;
  }, [projects]);

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
    sales
      .filter((s) => s.status !== "cancelado" && inRange(s))
      .forEach((s) => {
        const b = map.get(s.data.slice(0, 7));
        if (b) b.receita += Number(s.valor);
      });
    expenses.filter(inRange).forEach((e) => {
      const b = map.get(e.data.slice(0, 7));
      if (b) b.despesa += Number(e.valor);
    });
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, expenses, range]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    expenses.filter(inRange).forEach((e) => {
      m.set(e.categoria, (m.get(e.categoria) ?? 0) + Number(e.valor));
    });
    return Array.from(m.entries())
      .map(([key, value]) => ({ key, label: CATEGORY_LABEL.get(key) ?? key, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, range]);

  async function deleteExpense(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error("Não foi possível excluir", { description: error.message });
    toast.success("Despesa excluída");
    fetchAll();
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Administração</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Financeiro</h1>
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
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          hint={`${expenses.filter(inRange).length} lançamentos`}
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
                    }}
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
                          fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(11,15,26,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
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
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
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
                      <TableCell className="font-medium">{e.descricao}</TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20">
                          {CATEGORY_LABEL.get(e.categoria) ?? e.categoria}
                        </span>
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
            expense={editing}
            onSaved={() => {
              setEditing(null);
              fetchAll();
            }}
          />
        )}
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
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-3 text-2xl font-semibold tracking-tight", accent)}>{value}</p>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
            <Icon className="size-4" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({
  projects,
  expense,
  onSaved,
}: {
  projects: ProjectLite[];
  expense?: Expense;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState(expense?.descricao ?? "");
  const [categoria, setCategoria] = useState(expense?.categoria ?? "outros");
  const [valor, setValor] = useState(expense ? String(expense.valor) : "");
  const [data, setData] = useState(expense?.data ?? new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState<string>(expense?.project_id ?? "none");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const payload = {
      descricao,
      categoria,
      valor: Number(valor.replace(",", ".")) || 0,
      data,
      project_id: projectId === "none" ? null : projectId,
    };
    const res = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase
          .from("expenses")
          .insert({ ...payload, created_by: sess.session?.user.id });
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
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
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
