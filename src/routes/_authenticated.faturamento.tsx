import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  DollarSign,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
  Repeat,
  Pause,
  Play,
  StopCircle,
} from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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
  subscription_id?: string | null;
  competencia?: string | null;
};
type ProjectLite = { id: string; nome: string; cliente: string | null; client_id: string | null };
type Subscription = {
  id: string;
  project_id: string;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_contato: string | null;
  valor_inicial: number;
  valor_mensal: number;
  dia_cobranca: number;
  data_inicio: string;
  duracao_meses: number | null;
  status: "ativa" | "pausada" | "encerrada";
  observacoes: string | null;
};
type Attachment = {
  id: string;
  sale_id: string;
  nome: string;
  path: string;
  size: number | null;
  mime: string | null;
  created_at: string;
};

type SortKey = "data" | "valor" | "cliente_nome" | "status";
type SortDir = "asc" | "desc";
type FaturamentoSearch = {
  project?: string;
  page?: number;
  q?: string;
  sort?: SortKey;
  dir?: SortDir;
};

const PAGE_SIZE = 20;

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
    page: typeof s.page === "number" ? s.page : Number(s.page) || undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    sort: (["data", "valor", "cliente_nome", "status"].includes(String(s.sort))
      ? (s.sort as SortKey)
      : undefined),
    dir: s.dir === "asc" || s.dir === "desc" ? s.dir : undefined,
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
  const [totalCount, setTotalCount] = useState(0);
  const [aggregates, setAggregates] = useState({ total: 0, pago: 0, pendente: 0, count: 0 });
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [statusFilter, setStatusFilter] = useState<"todos" | SaleStatus>("todos");
  const [projectFilter, setProjectFilter] = useState<string>(search.project ?? "todos");
  const [query, setQuery] = useState(search.q ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(search.q ?? "");
  const [page, setPage] = useState<number>(search.page ?? 1);
  const [sortKey, setSortKey] = useState<SortKey>(search.sort ?? "data");
  const [sortDir, setSortDir] = useState<SortDir>(search.dir ?? "desc");
  const [open, setOpen] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [deleteSale, setDeleteSale] = useState<Sale | null>(null);
  const [attachmentsSale, setAttachmentsSale] = useState<Sale | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, projectFilter, period, sortKey, sortDir]);

  const range = useMemo(() => periodRange(period), [period]);

  const buildBaseQuery = useCallback(() => {
    let q = supabase.from("sales").select("*", { count: "exact" });
    if (range.from) q = q.gte("data", range.from);
    if (statusFilter !== "todos") q = q.eq("status", statusFilter);
    if (projectFilter !== "todos") q = q.eq("project_id", projectFilter);
    if (debouncedQuery) {
      const like = `%${debouncedQuery}%`;
      q = q.or(
        `cliente_nome.ilike.${like},cliente_email.ilike.${like},cliente_contato.ilike.${like},observacoes.ilike.${like}`,
      );
    }
    return q;
  }, [range.from, statusFilter, projectFilter, debouncedQuery]);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from("projects").select("id, nome, cliente, client_id").order("nome");
    setProjects((data ?? []) as ProjectLite[]);
  }, []);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    // Gera ocorrências pendentes antes de listar (idempotente).
    await supabase.rpc("generate_recurrences");
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const pageRes = await buildBaseQuery()
      .order(sortKey, { ascending: sortDir === "asc" })
      .range(from, to);
    const aggRes = await buildBaseQuery();
    if (pageRes.error) {
      toast.error("Erro ao carregar vendas", { description: pageRes.error.message });
      setLoading(false);
      return;
    }
    setSales((pageRes.data ?? []) as Sale[]);
    setTotalCount(pageRes.count ?? 0);
    const all = (aggRes.data ?? []) as Sale[];
    setAggregates({
      total: all.reduce((a, s) => a + Number(s.valor), 0),
      pago: all.filter((s) => s.status === "pago").reduce((a, s) => a + Number(s.valor), 0),
      pendente: all.filter((s) => s.status === "pendente").reduce((a, s) => a + Number(s.valor), 0),
      count: all.length,
    });
    const subRes = await supabase
      .from("sale_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    setSubscriptions((subRes.data ?? []) as Subscription[]);
    setLoading(false);
  }, [buildBaseQuery, page, sortKey, sortDir]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const projectMap = useMemo(() => {
    const m = new Map<string, ProjectLite>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "data" || k === "valor" ? "desc" : "asc");
    }
  }

  async function exportCsv() {
    toast.loading("Preparando exportação…", { id: "csv-export" });
    const { data, error } = await buildBaseQuery().order(sortKey, {
      ascending: sortDir === "asc",
    });
    if (error) {
      toast.error("Falha ao exportar", { id: "csv-export", description: error.message });
      return;
    }
    const rows = (data ?? []) as Sale[];
    const header = [
      "Data",
      "Cliente",
      "Email",
      "Contato",
      "Projeto",
      "Valor",
      "Status",
      "Observações",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(";")].concat(
      rows.map((s) =>
        [
          s.data,
          s.cliente_nome,
          s.cliente_email ?? "",
          s.cliente_contato ?? "",
          projectMap.get(s.project_id)?.nome ?? "",
          Number(s.valor).toFixed(2).replace(".", ","),
          STATUS_META[s.status].label,
          s.observacoes ?? "",
        ]
          .map(escape)
          .join(";"),
      ),
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exportadas ${rows.length} vendas`, { id: "csv-export" });
  }

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
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="size-4" /> Exportar CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Nova venda
              </Button>
            </DialogTrigger>
            <SaleDialog
              mode="create"
              projects={projects}
              onDone={() => {
                setOpen(false);
                fetchSales();
              }}
            />
          </Dialog>
        </div>
      </header>

      {subscriptions.filter((s) => s.status !== "encerrada").length > 0 && (
        <SubscriptionsCard
          subscriptions={subscriptions}
          projectMap={projectMap}
          onChanged={fetchSales}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label={isAdmin ? "Total do período" : "Seu total no período"}
          value={brl(aggregates.total)}
          hint={`${aggregates.count} vendas`}
          icon={Wallet}
        />
        <SummaryCard
          label="Pago"
          value={brl(aggregates.pago)}
          hint="Recebido"
          icon={DollarSign}
          accent="text-emerald-300"
        />
        <SummaryCard
          label="Pendente"
          value={brl(aggregates.pendente)}
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
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, email, obs…"
                className="h-9 w-[240px] rounded-full pl-9 pr-8"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Limpar"
                >
                  <X className="size-3.5" />
                </button>
              )}
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
          ) : sales.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma venda no filtro atual.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>
                      <SortHeader
                        label="Cliente"
                        active={sortKey === "cliente_nome"}
                        dir={sortDir}
                        onClick={() => toggleSort("cliente_nome")}
                      />
                    </TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>
                      <SortHeader
                        label="Valor"
                        active={sortKey === "valor"}
                        dir={sortDir}
                        onClick={() => toggleSort("valor")}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Status"
                        active={sortKey === "status"}
                        dir={sortDir}
                        onClick={() => toggleSort("status")}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Data"
                        active={sortKey === "data"}
                        dir={sortDir}
                        onClick={() => toggleSort("data")}
                      />
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => {
                    const proj = projectMap.get(s.project_id);
                    const meta = STATUS_META[s.status];
                    return (
                      <TableRow key={s.id} className="border-border/50">
                        <TableCell>
                          <div className="font-medium">{s.cliente_nome}</div>
                          {s.cliente_email && (
                            <div className="text-xs text-muted-foreground">{s.cliente_email}</div>
                          )}
                          {s.subscription_id && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20">
                              <Repeat className="size-3" /> Assinatura
                            </span>
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
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditSale(s)}>
                                <Pencil className="mr-2 size-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAttachmentsSale(s)}>
                                <Paperclip className="mr-2 size-4" /> Anexos
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteSale(s)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 size-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && sales.length > 0 && (
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span>
                Página {page} de {totalPages} · {totalCount} vendas
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editSale && (
        <Dialog open onOpenChange={(o) => !o && setEditSale(null)}>
          <SaleDialog
            mode="edit"
            sale={editSale}
            projects={projects}
            onDone={() => {
              setEditSale(null);
              fetchSales();
            }}
          />
        </Dialog>
      )}

      {attachmentsSale && (
        <AttachmentsDialog
          sale={attachmentsSale}
          onClose={() => setAttachmentsSale(null)}
        />
      )}

      <AlertDialog open={!!deleteSale} onOpenChange={(o) => !o && setDeleteSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda de <strong>{deleteSale?.cliente_nome}</strong> ({deleteSale && brl(Number(deleteSale.valor))}) e todos os seus anexos serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteSale) return;
                const { error } = await supabase.from("sales").delete().eq("id", deleteSale.id);
                if (error) return toast.error("Não foi possível excluir", { description: error.message });
                toast.success("Venda excluída");
                setDeleteSale(null);
                fetchSales();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium transition",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <Icon className="size-3" />
    </button>
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

function SaleDialog({
  mode,
  sale,
  projects,
  onDone,
}: {
  mode: "create" | "edit";
  sale?: Sale;
  projects: ProjectLite[];
  onDone: () => void;
}) {
  const [projectId, setProjectId] = useState<string>(sale?.project_id ?? "");
  const [nome, setNome] = useState(sale?.cliente_nome ?? "");
  const [email, setEmail] = useState(sale?.cliente_email ?? "");
  const [contato, setContato] = useState(sale?.cliente_contato ?? "");
  const [valor, setValor] = useState(sale ? String(sale.valor).replace(".", ",") : "");
  const [status, setStatus] = useState<SaleStatus>(sale?.status ?? "pendente");
  const [data, setData] = useState(sale?.data ?? new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState(sale?.observacoes ?? "");
  const [loading, setLoading] = useState(false);
  const [nfEmitida, setNfEmitida] = useState<boolean>(Boolean((sale as unknown as { nf_emitida?: boolean })?.nf_emitida));
  const [nfNumero, setNfNumero] = useState<string>(String((sale as unknown as { nf_numero?: string | null })?.nf_numero ?? ""));
  const canPickType = mode === "create";
  const [tipo, setTipo] = useState<"avulsa" | "assinatura">("avulsa");
  const [valorMensal, setValorMensal] = useState("");
  const [diaCobranca, setDiaCobranca] = useState<string>(String(new Date().getDate()));
  const [continua, setContinua] = useState(true);
  const [duracao, setDuracao] = useState<string>("12");

  // Pré-preencher dados do cliente ao selecionar projeto vinculado (apenas em criação)
  React.useEffect(() => {
    if (mode !== "create" || !projectId) return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    (async () => {
      if (proj.client_id) {
        const { data: c } = await supabase
          .from("clients")
          .select("nome, email, telefone")
          .eq("id", proj.client_id)
          .maybeSingle();
        if (c) {
          if (!nome) setNome(c.nome ?? "");
          if (!email) setEmail(c.email ?? "");
          if (!contato) setContato((c as { telefone?: string | null }).telefone ?? "");
          return;
        }
      }
      if (!nome && proj.cliente) setNome(proj.cliente);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return toast.error("Selecione um projeto");
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();

    if (canPickType && tipo === "assinatura") {
      const mensal = Number(String(valorMensal).replace(",", ".")) || 0;
      if (mensal <= 0) {
        setLoading(false);
        return toast.error("Informe o valor mensal da assinatura.");
      }
      const dia = Math.min(31, Math.max(1, Number(diaCobranca) || 1));
      const insertSub = await supabase.from("sale_subscriptions").insert({
        project_id: projectId,
        cliente_nome: nome,
        cliente_email: email || null,
        cliente_contato: contato || null,
        valor_inicial: Number(String(valor).replace(",", ".")) || 0,
        valor_mensal: mensal,
        dia_cobranca: dia,
        data_inicio: data,
        duracao_meses: continua ? null : Math.max(1, Number(duracao) || 1),
        status: "ativa",
        observacoes: obs || null,
        created_by: sess.session?.user.id,
      });
      if (insertSub.error) {
        setLoading(false);
        return toast.error("Erro ao criar assinatura", { description: insertSub.error.message });
      }
      await supabase.rpc("generate_recurrences");
      setLoading(false);
      toast.success("Assinatura criada");
      onDone();
      return;
    }

    const payload = {
      project_id: projectId,
      cliente_nome: nome,
      cliente_email: email || null,
      cliente_contato: contato || null,
      valor: Number(String(valor).replace(",", ".")) || 0,
      status,
      data,
      observacoes: obs || null,
      nf_emitida: nfEmitida,
      nf_numero: nfEmitida ? (nfNumero || null) : null,
    };
    let error;
    if (mode === "edit" && sale) {
      ({ error } = await supabase.from("sales").update(payload).eq("id", sale.id));
    } else {
      ({ error } = await supabase
        .from("sales")
        .insert({ ...payload, created_by: sess.session?.user.id }));
    }
    setLoading(false);
    if (error) return toast.error("Não foi possível salvar", { description: error.message });
    toast.success(mode === "edit" ? "Venda atualizada" : "Venda registrada");
    onDone();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{mode === "edit" ? "Editar venda" : "Nova venda"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {canPickType && (
          <div className="inline-flex rounded-full border border-border/50 bg-card/60 p-1">
            {(["avulsa", "assinatura"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  tipo === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "avulsa" ? "Avulsa" : "Assinatura"}
              </button>
            ))}
          </div>
        )}
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
            <Label htmlFor="s-valor">
              {tipo === "assinatura" ? "Valor inicial (R$)" : "Valor (R$)"}
            </Label>
            <Input
              id="s-valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required={tipo === "avulsa"}
              placeholder={tipo === "assinatura" ? "0,00 (opcional)" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">E-mail</Label>
            <Input
              id="s-email"
              type="email"
              value={email ?? ""}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-contato">Contato</Label>
            <Input id="s-contato" value={contato ?? ""} onChange={(e) => setContato(e.target.value)} />
          </div>
          {tipo === "avulsa" && (
            <>
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
            </>
          )}
          {tipo === "assinatura" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="s-mensal">Valor mensal (R$)</Label>
                <Input
                  id="s-mensal"
                  inputMode="decimal"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-dia">Dia da cobrança</Label>
                <Input
                  id="s-dia"
                  type="number"
                  min={1}
                  max={31}
                  value={diaCobranca}
                  onChange={(e) => setDiaCobranca(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-inicio">Início</Label>
                <Input
                  id="s-inicio"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duração</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={continua} onCheckedChange={setContinua} />
                  <span className="text-xs text-muted-foreground">Contínua</span>
                  {!continua && (
                    <Input
                      type="number"
                      min={1}
                      value={duracao}
                      onChange={(e) => setDuracao(e.target.value)}
                      className="ml-auto w-20"
                    />
                  )}
                  {!continua && <span className="text-xs text-muted-foreground">meses</span>}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-obs">Observações</Label>
          <Textarea id="s-obs" rows={3} value={obs ?? ""} onChange={(e) => setObs(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {mode === "edit"
              ? "Salvar alterações"
              : tipo === "assinatura"
                ? "Criar assinatura"
                : "Registrar venda"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SubscriptionsCard({
  subscriptions,
  projectMap,
  onChanged,
}: {
  subscriptions: Subscription[];
  projectMap: Map<string, ProjectLite>;
  onChanged: () => void;
}) {
  const active = subscriptions.filter((s) => s.status !== "encerrada");

  async function setStatus(id: string, status: Subscription["status"]) {
    const { error } = await supabase.from("sale_subscriptions").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar", { description: error.message });
    toast.success(
      status === "pausada" ? "Assinatura pausada" : status === "ativa" ? "Assinatura retomada" : "Assinatura encerrada",
    );
    if (status === "ativa") await supabase.rpc("generate_recurrences");
    onChanged();
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Assinaturas
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {active.length} ativa{active.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {active.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.cliente_nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {projectMap.get(s.project_id)?.nome ?? "—"} · {brl(Number(s.valor_mensal))}/mês · dia {s.dia_cobranca}
                  {s.duracao_meses ? ` · ${s.duracao_meses} meses` : " · contínua"}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  s.status === "ativa"
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                    : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
                )}
              >
                {s.status}
              </span>
              {s.status === "ativa" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Pausar"
                  onClick={() => setStatus(s.id, "pausada")}
                >
                  <Pause className="size-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Retomar"
                  onClick={() => setStatus(s.id, "ativa")}
                >
                  <Play className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-rose-300 hover:text-rose-200"
                title="Encerrar"
                onClick={() => {
                  if (confirm("Encerrar esta assinatura? Vendas já geradas serão mantidas."))
                    setStatus(s.id, "encerrada");
                }}
              >
                <StopCircle className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AttachmentsDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sale_attachments")
      .select("*")
      .eq("sale_id", sale.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar anexos", { description: error.message });
    setItems((data ?? []) as Attachment[]);
    setLoading(false);
  }, [sale.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      return toast.error("Arquivo muito grande", { description: "Máximo 25 MB." });
    }
    setUploading(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${sale.id}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from("sale-attachments").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (up.error) {
      setUploading(false);
      return toast.error("Falha no upload", { description: up.error.message });
    }
    const { error } = await supabase.from("sale_attachments").insert({
      sale_id: sale.id,
      nome: file.name,
      path,
      size: file.size,
      mime: file.type || null,
      uploaded_by: uid,
    });
    setUploading(false);
    if (error) {
      await supabase.storage.from("sale-attachments").remove([path]);
      return toast.error("Falha ao registrar anexo", { description: error.message });
    }
    toast.success("Anexo enviado");
    load();
  }

  async function download(a: Attachment) {
    const { data, error } = await supabase.storage
      .from("sale-attachments")
      .createSignedUrl(a.path, 60);
    if (error || !data) return toast.error("Falha ao abrir arquivo", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(a: Attachment) {
    const { error } = await supabase.from("sale_attachments").delete().eq("id", a.id);
    if (error) return toast.error("Não foi possível excluir", { description: error.message });
    await supabase.storage.from("sale-attachments").remove([a.path]);
    toast.success("Anexo removido");
    load();
  }

  function fmtSize(n: number | null) {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Anexos · {sale.cliente_nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/40 p-4 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Enviando…" : "Selecionar arquivo (até 25 MB)"}
            <input
              type="file"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>

          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum anexo ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border/50 rounded-xl border border-border/50">
              {items.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => download(a)}
                      className="block truncate text-sm font-medium hover:text-primary"
                    >
                      {a.nome}
                    </button>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtSize(a.size)} ·{" "}
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
