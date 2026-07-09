import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Contact, Loader2, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

type Client = {
  id: string;
  nome: string;
  email: string | null;
  contato: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
};

type SaleRow = { client_id: string | null; valor: number; status: string };

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function ClientesPage() {
  const { user, isFinance } = Route.useRouteContext();
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [projectCounts, setProjectCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [busca, setBusca] = useState("");

  async function fetchAll() {
    setLoading(true);
    const [cRes, sRes, pRes] = await Promise.all([
      supabase.from("clients").select("*").order("nome"),
      supabase.from("sales").select("client_id, valor, status"),
      supabase.from("projects").select("client_id"),
    ]);
    if (cRes.error) toast.error("Erro ao carregar", { description: cRes.error.message });
    setClients((cRes.data ?? []) as Client[]);
    setSales((sRes.data ?? []) as SaleRow[]);
    const pc = new Map<string, number>();
    (pRes.data ?? []).forEach((p: { client_id: string | null }) => {
      if (!p.client_id) return;
      pc.set(p.client_id, (pc.get(p.client_id) ?? 0) + 1);
    });
    setProjectCounts(pc);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const ltv = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    sales.forEach((s) => {
      if (!s.client_id || s.status === "cancelado") return;
      const cur = m.get(s.client_id) ?? { total: 0, count: 0 };
      cur.total += Number(s.valor);
      cur.count += 1;
      m.set(s.client_id, cur);
    });
    return m;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.nome, c.email, c.contato].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [clients, busca]);

  async function remove(c: Client) {
    if (!isFinance) return toast.error("Somente admin/contadora podem excluir clientes.");
    if (!confirm(`Excluir cliente "${c.nome}"? Projetos e vendas ficarão sem cliente vinculado.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Cliente removido");
    fetchAll();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro central de clientes com histórico de valor gerado (LTV).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Novo cliente
            </Button>
          </DialogTrigger>
          <ClientDialog
            userId={user.id}
            onSaved={() => {
              setOpen(false);
              fetchAll();
            }}
          />
        </Dialog>
      </header>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="p-4">
          <Input
            placeholder="Buscar por nome, e-mail ou contato…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 max-w-md"
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/60 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Contact className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const stats = ltv.get(c.id);
            const projetos = projectCounts.get(c.id) ?? 0;
            return (
              <Card
                key={c.id}
                className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl"
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                      <Contact className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">{c.nome}</p>
                      {c.email && (
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <Mail className="size-3" /> {c.email}
                        </p>
                      )}
                      {c.contato && (
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <Phone className="size-3" /> {c.contato}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setEditing(c)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {isFinance && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-300 hover:text-rose-200"
                          onClick={() => remove(c)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-background/40 p-3 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">LTV</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-300">
                        {brl(stats?.total ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Vendas</p>
                      <p className="mt-1 text-sm font-semibold">{stats?.count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Projetos</p>
                      <p className="mt-1 text-sm font-semibold">{projetos}</p>
                    </div>
                  </div>
                  {c.observacoes && (
                    <p className="line-clamp-3 text-xs text-muted-foreground">{c.observacoes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <ClientDialog
            userId={user.id}
            client={editing}
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

function ClientDialog({
  userId,
  client,
  onSaved,
}: {
  userId: string;
  client?: Client;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(client?.nome ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [contato, setContato] = useState(client?.contato ?? "");
  const [observacoes, setObservacoes] = useState(client?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      email: email.trim() || null,
      contato: contato.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    const res = client
      ? await supabase.from("clients").update(payload).eq("id", client.id)
      : await supabase.from("clients").insert({ ...payload, created_by: userId });
    setSaving(false);
    if (res.error) return toast.error("Não foi possível salvar", { description: res.error.message });
    toast.success(client ? "Cliente atualizado" : "Cliente cadastrado");
    onSaved();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c-nome">Nome</Label>
          <Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-email">E-mail</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-contato">Contato</Label>
            <Input
              id="c-contato"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="WhatsApp, telefone…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-obs">Observações</Label>
          <Textarea
            id="c-obs"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving} className="w-full gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {client ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}