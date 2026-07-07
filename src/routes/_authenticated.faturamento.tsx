import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DollarSign, Loader2, Plus, TrendingUp, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type SaleStatus = "pendente" | "pago" | "cancelado";
type Sale = {
  id: string;
  project_id: string;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_contato: string | null;
  valor: number;
  status: SaleStatus;
  data: string;
  observacoes: string | null;
};
type ProjectLite = { id: string; nome: string; cliente: string | null };

type FaturamentoSearch = { project?: string };

const STATUS_META: Record<SaleStatus, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30" },
  pago: { label: "Pago", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" },
  cancelado: { label: "Cancelado", className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30" },
};

const PERIODS = [
  { key: "30", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "90", label: "90 dias" },
  { key: "ano", label: "Este ano" },
  { key: "todos", label: "Tudo" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export const Route = createFileRoute("/_authenticated/faturamento")({
  validateSearch: (s: Record<string, unknown>): FaturamentoSearch => ({
    project: typeof s.project === "string" ? s.project : undefined,
  }),
  component: FaturamentoPage,
});

function periodRange(key: PeriodKey): { from?: string; to?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "todos") return {};
  if (key === "mes") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(from) };
  }
  if (key === "ano") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: iso(from) };
  }
  const days = key === "30" ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: iso(from) };
}

function FaturamentoPage() {
  const { isAdmin } = Route.useRouteContext();
  const search = Route.useSearch();
  const [sales, setSales] = useState<Sale[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [statusFilter, setStatusFilter] = useState<"todos" | SaleStatus>("todos");
  const [projectFilter, setProjectFilter] = useState<string>(search.project ?? "todos");
  const [open, setOpen] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const [salesRes, projectsRes] = await Promise.all([
      supabase.from("sales").select("*").order("data", { ascending: false }),
      supabase.from("projects").select("id, nome, cliente").order("nome"),
    ]);
    if (salesRes.error) toast.error("Erro ao carregar vendas", { description: salesRes.error.message });
    setSales((salesRes.data ?? []) as Sale[]);
    setProjects((projectsRes.data ?? []) as ProjectLite[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const projectMap = useMemo(() => {
    const m = new Map<string, ProjectLite>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const range = useMemo(() => periodRange(period), [period]);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (range.from && s.data < range.from) return false;
      if (statusFilter !== "todos" && s.status !== statusFilter) return false;
      if (projectFilter !== "todos" && s.project_id !== projectFilter) return false;
      return true;
    });
  }, [sales, range, statusFilter, projectFilter]);

  const totalPeriodo = filtered.reduce((acc, s) => acc + Number(s.valor), 0);
  const totalPago = filtered
    .filter((s) => s.status === "pago")
    .reduce((acc, s) => acc + Number(s.valor), 0);
  const totalPendente = filtered
    .filter((s) => s.status === "pendente")
    .reduce((acc, s) => acc + Number(s.valor), 0);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Faturamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Todas as vendas dos projetos da DPlay."
              : "Vendas dos projetos em que você participa."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Nova venda
            </Button>
          </DialogTrigger>
          <NewSaleDialog
            projects={projects}
            onCreated={() => {
              setOpen(false);
              fetchAll();
            }}
          />
        </Dialog>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label={isAdmin ? "Total do período" : "Seu total no período"}
          value={brl(totalPeriodo)}
          hint={`${filtered.length} vendas`}
          icon={Wallet}
        />
        <SummaryCard
          label="Pago"
          value={brl(totalPago)}
          hint="Recebido"
          icon={DollarSign}
          accent="text-emerald-300"
        />
        <SummaryCard
          label="Pendente"
          value={brl(totalPendente)}
          hint="A receber"
          icon={TrendingUp}
          accent="text-amber-300"
        />
      </div>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card/60 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    period === p.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-[220px] rounded-full">
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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-9 w-[160px] rounded-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma venda no filtro atual.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const proj = projectMap.get(s.project_id);
                    const meta = STATUS_META[s.status];
                    return (
                      <TableRow key={s.id} className="border-border/50">
                        <TableCell>
                          <div className="font-medium">{s.cliente_nome}</div>
                          {s.cliente_email && (
                            <div className="text-xs text-muted-foreground">{s.cliente_email}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {proj?.nome ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{brl(Number(s.valor))}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(s.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
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

function NewSaleDialog({
  projects,
  onCreated,
}: {
  projects: ProjectLite[];
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [contato, setContato] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<SaleStatus>("pendente");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return toast.error("Selecione um projeto");
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("sales").insert({
      project_id: projectId,
      cliente_nome: nome,
      cliente_email: email || null,
      cliente_contato: contato || null,
      valor: Number(valor.replace(",", ".")) || 0,
      status,
      data,
      observacoes: obs || null,
      created_by: sess.session?.user.id,
    });
    setLoading(false);
    if (error) return toast.error("Não foi possível registrar", { description: error.message });
    toast.success("Venda registrada");
    onCreated();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Nova venda</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Projeto</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-nome">Cliente</Label>
            <Input id="s-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-valor">Valor (R$)</Label>
            <Input
              id="s-valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">E-mail</Label>
            <Input
              id="s-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-contato">Contato</Label>
            <Input id="s-contato" value={contato} onChange={(e) => setContato(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SaleStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-data">Data</Label>
            <Input
              id="s-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-obs">Observações</Label>
          <Textarea id="s-obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Registrar venda
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
