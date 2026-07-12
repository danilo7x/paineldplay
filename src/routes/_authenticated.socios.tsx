import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Handshake,
  Plus,
  Calendar as CalendarIcon,
  ListTodo,
  StickyNote,
  Trash2,
  Pencil,
  Video,
  MapPin,
  Flag,
  CheckCircle2,
  Circle,
  Loader2,
  Lightbulb,
  ArrowRightLeft,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Author = { id: string; nome: string | null; avatar_url: string | null };

export const Route = createFileRoute("/_authenticated/socios")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: SociosPage,
});

function SociosPage() {
  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <Handshake className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Central dos Sócios</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Espaço compartilhado entre os administradores. Tudo aqui é visível apenas aos sócios.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="agenda" className="gap-1.5">
            <CalendarIcon className="size-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-1.5">
            <ListTodo className="size-4" /> Tarefas
          </TabsTrigger>
          <TabsTrigger value="notas" className="gap-1.5">
            <StickyNote className="size-4" /> Notas & Ideias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda"><AgendaSection /></TabsContent>
        <TabsContent value="tarefas"><TarefasSection /></TabsContent>
        <TabsContent value="notas"><NotasSection /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Author helpers                                                     */
/* ------------------------------------------------------------------ */

function useAuthors(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  return useQuery({
    queryKey: ["socios-authors", unique.sort().join(",")],
    queryFn: async () => {
      if (!unique.length) return {} as Record<string, Author>;
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", unique);
      const map: Record<string, Author> = {};
      (data ?? []).forEach((p) => (map[p.id] = p as Author));
      return map;
    },
    enabled: unique.length > 0,
    staleTime: 60_000,
  });
}

function AuthorChip({ author, label }: { author?: Author; label?: string }) {
  const initials = (author?.nome ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Avatar className="size-5">
        <AvatarImage src={author?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary/20 text-[9px] font-semibold text-primary">{initials}</AvatarFallback>
      </Avatar>
      <span className="truncate">{label ? `${label} ` : ""}{author?.nome ?? "—"}</span>
    </div>
  );
}

/* ================================================================== */
/* AGENDA                                                             */
/* ================================================================== */

type PEvent = {
  id: string;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  local: string | null;
  link: string | null;
  tipo: "reuniao" | "compromisso" | "lembrete";
  recorrencia: "nenhuma" | "semanal" | "mensal";
  pauta: string | null;
  ata: string | null;
  created_by: string;
};

function AgendaSection() {
  const qc = useQueryClient();
  const [view, setView] = useState<"semana" | "mes">("semana");
  const [anchor, setAnchor] = useState(new Date());
  const [editing, setEditing] = useState<PEvent | null>(null);
  const [open, setOpen] = useState(false);

  const range = useMemo(() => {
    if (view === "semana") {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      return { start, end: addDays(start, 7) };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { start, end };
  }, [anchor, view]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["partner_events", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_events")
        .select("*")
        .gte("inicio", range.start.toISOString())
        .lt("inicio", range.end.toISOString())
        .order("inicio");
      if (error) throw error;
      return (data ?? []) as PEvent[];
    },
  });

  const { data: authors = {} } = useAuthors(events.map((e) => e.created_by));

  const days = useMemo(() => {
    if (view === "semana") return Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
    const total = Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000);
    return Array.from({ length: total }, (_, i) => addDays(range.start, i));
  }, [range, view]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento excluído");
      qc.invalidateQueries({ queryKey: ["partner_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, view === "semana" ? -7 : -30))}>‹</Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {view === "semana"
              ? `${format(range.start, "dd/MM", { locale: ptBR })} – ${format(addDays(range.start, 6), "dd/MM", { locale: ptBR })}`
              : format(anchor, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, view === "semana" ? 7 : 30))}>›</Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>Hoje</Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => setView(v as "semana" | "mes")}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4" /> Novo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => {
            const dayEvents = events.filter((e) => isSameDay(parseISO(e.inicio), d));
            return (
              <Card key={d.toISOString()} className={cn("border-border/60", isSameDay(d, new Date()) && "ring-1 ring-primary/40")}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {format(d, "EEE dd/MM", { locale: ptBR })}
                    </div>
                    {isSameDay(d, new Date()) && <Badge variant="secondary" className="text-[10px]">Hoje</Badge>}
                  </div>
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">— sem eventos —</p>
                  ) : dayEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => { setEditing(e); setOpen(true); }}
                      className="w-full rounded-lg border border-border/60 bg-card/40 p-2 text-left transition hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "size-2 rounded-full",
                              e.tipo === "reuniao" && "bg-primary",
                              e.tipo === "compromisso" && "bg-amber-400",
                              e.tipo === "lembrete" && "bg-emerald-400",
                            )} />
                            <p className="truncate text-sm font-medium">{e.titulo}</p>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {format(parseISO(e.inicio), "HH:mm")}{e.fim ? `–${format(parseISO(e.fim), "HH:mm")}` : ""}
                            {e.local ? ` · ${e.local}` : ""}
                          </p>
                          <div className="mt-1"><AuthorChip author={authors[e.created_by]} label="por" /></div>
                        </div>
                        {e.link && <Video className="size-3.5 shrink-0 text-primary" />}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EventDialog
        open={open}
        onOpenChange={setOpen}
        event={editing}
        onDelete={editing ? () => { delMut.mutate(editing.id); setOpen(false); } : undefined}
      />
    </div>
  );
}

function EventDialog({
  open, onOpenChange, event, onDelete,
}: { open: boolean; onOpenChange: (v: boolean) => void; event: PEvent | null; onDelete?: () => void }) {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const [form, setForm] = useState({
    titulo: "", descricao: "", inicio: "", fim: "", local: "", link: "",
    tipo: "reuniao" as PEvent["tipo"], recorrencia: "nenhuma" as PEvent["recorrencia"],
    pauta: "", ata: "",
  });

  useMemo(() => {
    if (event) {
      setForm({
        titulo: event.titulo,
        descricao: event.descricao ?? "",
        inicio: event.inicio.slice(0, 16),
        fim: event.fim ? event.fim.slice(0, 16) : "",
        local: event.local ?? "", link: event.link ?? "",
        tipo: event.tipo, recorrencia: event.recorrencia,
        pauta: event.pauta ?? "", ata: event.ata ?? "",
      });
    } else if (open) {
      const now = new Date(); now.setMinutes(0, 0, 0);
      setForm({
        titulo: "", descricao: "",
        inicio: format(now, "yyyy-MM-dd'T'HH:mm"),
        fim: "", local: "", link: "",
        tipo: "reuniao", recorrencia: "nenhuma", pauta: "", ata: "",
      });
    }
  }, [event, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: form.titulo, descricao: form.descricao || null,
        inicio: new Date(form.inicio).toISOString(),
        fim: form.fim ? new Date(form.fim).toISOString() : null,
        local: form.local || null, link: form.link || null,
        tipo: form.tipo, recorrencia: form.recorrencia,
        pauta: form.pauta || null, ata: form.ata || null,
      };
      if (event) {
        const { error } = await supabase.from("partner_events")
          .update({ ...payload, updated_by: user.id }).eq("id", event.id);
        if (error) throw error;

        // Se recorrente, gerar próxima ocorrência (idempotente por titulo+inicio)
      } else {
        const { data, error } = await supabase.from("partner_events")
          .insert({ ...payload, created_by: user.id }).select("id, inicio, titulo, recorrencia").maybeSingle();
        if (error) throw error;
        // gerar próximas 8 ocorrências se recorrente
        if (data && data.recorrencia !== "nenhuma") {
          const base = new Date(data.inicio);
          const rows = Array.from({ length: 8 }, (_, k) => {
            const i = k + 1;
            const nd = new Date(base);
            if (data.recorrencia === "semanal") nd.setDate(nd.getDate() + 7 * i);
            else nd.setMonth(nd.getMonth() + i);
            return {
              ...payload,
              recorrencia: "nenhuma" as const,
              inicio: nd.toISOString(),
              fim: form.fim
                ? new Date(new Date(form.fim).getTime() + (nd.getTime() - base.getTime())).toISOString()
                : null,
              created_by: user.id,
            };
          });
          await supabase.from("partner_events").insert(rows);
        }
      }
    },
    onSuccess: () => {
      toast.success(event ? "Evento atualizado" : "Evento criado");
      qc.invalidateQueries({ queryKey: ["partner_events"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toTask = useMutation({
    mutationFn: async (titulo: string) => {
      const { error } = await supabase.from("partner_tasks").insert({
        titulo, status: "a_fazer", prioridade: "media",
        origem_event_id: event?.id ?? null, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item convertido em tarefa");
      qc.invalidateQueries({ queryKey: ["partner_tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>Reuniões, compromissos ou lembretes dos sócios.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as PEvent["tipo"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="compromisso">Compromisso</SelectItem>
                  <SelectItem value="lembrete">Lembrete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Recorrência</Label>
              <Select value={form.recorrencia} onValueChange={(v) => setForm({ ...form, recorrencia: v as PEvent["recorrencia"] })} disabled={!!event}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Início</Label>
              <Input type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fim</Label>
              <Input type="datetime-local" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Escritório, café..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Link (call)</Label>
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://meet..." />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          {form.tipo === "reuniao" && (
            <>
              <div className="grid gap-1.5">
                <Label>Pauta (antes)</Label>
                <Textarea rows={2} value={form.pauta} onChange={(e) => setForm({ ...form, pauta: e.target.value })} placeholder="- item 1&#10;- item 2" />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>Ata / itens de ação (depois)</Label>
                  {form.ata.trim() && (
                    <div className="flex flex-wrap gap-1">
                      {form.ata.split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 5).map((line, i) => (
                        <Button key={i} type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                          onClick={() => toTask.mutate(line)}>
                          <ArrowRightLeft className="size-3" /> {line.slice(0, 22)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <Textarea rows={3} value={form.ata} onChange={(e) => setForm({ ...form, ata: e.target.value })} placeholder="- ação 1&#10;- ação 2" />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="destructive" onClick={onDelete} className="mr-auto">
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.titulo || !form.inicio || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* TAREFAS                                                            */
/* ================================================================== */

type PTask = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "a_fazer" | "fazendo" | "feito";
  prioridade: "baixa" | "media" | "alta";
  responsavel_id: string | null;
  responsavel_ambos: boolean;
  due_date: string | null;
  created_by: string;
  completed_at: string | null;
};

const COLS: { key: PTask["status"]; label: string }[] = [
  { key: "a_fazer", label: "A fazer" },
  { key: "fazendo", label: "Fazendo" },
  { key: "feito", label: "Feito" },
];

function TarefasSection() {
  const qc = useQueryClient();
  const { user, isAdmin: _ } = Route.useRouteContext();
  const [filterResp, setFilterResp] = useState<"todos" | "meu" | "socio" | "ambos">("todos");
  const [filterPrio, setFilterPrio] = useState<"todas" | "baixa" | "media" | "alta">("todas");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PTask | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["partner_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PTask[];
    },
  });

  const { data: admins = [] } = useQuery({
    queryKey: ["socios-admins"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as Author[];
      const { data } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", ids);
      return (data ?? []) as Author[];
    },
    staleTime: 60_000,
  });
  const { data: authors = {} } = useAuthors(tasks.flatMap((t) => [t.created_by, t.responsavel_id]));

  const filtered = tasks.filter((t) => {
    if (filterPrio !== "todas" && t.prioridade !== filterPrio) return false;
    if (filterResp === "meu" && t.responsavel_id !== user.id) return false;
    if (filterResp === "socio" && (t.responsavel_id === user.id || t.responsavel_id == null)) return false;
    if (filterResp === "ambos" && !t.responsavel_ambos) return false;
    return true;
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PTask["status"] }) => {
      const { error } = await supabase.from("partner_tasks").update({
        status, completed_at: status === "feito" ? new Date().toISOString() : null, updated_by: user.id,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner_tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tarefa removida"); qc.invalidateQueries({ queryKey: ["partner_tasks"] }); },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterResp} onValueChange={(v) => setFilterResp(v as typeof filterResp)}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="meu">Só meu</SelectItem>
            <SelectItem value="socio">Só do sócio</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPrio} onValueChange={(v) => setFilterPrio(v as typeof filterPrio)}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas prio.</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="ml-auto" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> Nova tarefa
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {COLS.map((col) => {
            const items = filtered.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="min-w-[85%] shrink-0 snap-start rounded-2xl border border-border/60 bg-card/40 p-2 sm:min-w-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</p>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground/70">— vazio —</p>}
                  {items.map((t) => (
                    <div key={t.id} className="rounded-xl border border-border/60 bg-background/60 p-2.5">
                      <div className="flex items-start gap-2">
                        <button onClick={() => updateStatus.mutate({ id: t.id, status: t.status === "feito" ? "a_fazer" : "feito" })}
                          className="mt-0.5 text-muted-foreground hover:text-primary">
                          {t.status === "feito" ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", t.status === "feito" && "line-through text-muted-foreground")}>{t.titulo}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={cn(
                              "h-5 text-[10px]",
                              t.prioridade === "alta" && "border-red-500/40 text-red-400",
                              t.prioridade === "media" && "border-amber-500/40 text-amber-400",
                              t.prioridade === "baixa" && "border-emerald-500/40 text-emerald-400",
                            )}>
                              <Flag className="size-3" /> {t.prioridade}
                            </Badge>
                            {t.due_date && (
                              <Badge variant="outline" className="h-5 text-[10px]">
                                {format(parseISO(t.due_date), "dd/MM", { locale: ptBR })}
                              </Badge>
                            )}
                            {t.responsavel_ambos ? (
                              <Badge variant="secondary" className="h-5 text-[10px]">Ambos</Badge>
                            ) : t.responsavel_id && (
                              <AuthorChip author={authors[t.responsavel_id]} />
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <AuthorChip author={authors[t.created_by]} label="criado por" />
                            <div className="flex items-center gap-1">
                              <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as PTask["status"] })}>
                                <SelectTrigger className="h-6 w-[92px] text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {COLS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" className="size-6" onClick={() => { setEditing(t); setOpen(true); }}>
                                <Pencil className="size-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => del.mutate(t.id)}>
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskDialog open={open} onOpenChange={setOpen} task={editing} admins={admins} />
    </div>
  );
}

function TaskDialog({
  open, onOpenChange, task, admins,
}: { open: boolean; onOpenChange: (v: boolean) => void; task: PTask | null; admins: Author[] }) {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const [form, setForm] = useState({
    titulo: "", descricao: "",
    status: "a_fazer" as PTask["status"], prioridade: "media" as PTask["prioridade"],
    responsavel: "meu" as "meu" | "socio" | "ambos" | "nenhum",
    due_date: "",
  });

  useMemo(() => {
    if (task) {
      const resp = task.responsavel_ambos ? "ambos"
        : task.responsavel_id === user.id ? "meu"
        : task.responsavel_id ? "socio" : "nenhum";
      setForm({
        titulo: task.titulo, descricao: task.descricao ?? "",
        status: task.status, prioridade: task.prioridade,
        responsavel: resp, due_date: task.due_date ?? "",
      });
    } else if (open) {
      setForm({ titulo: "", descricao: "", status: "a_fazer", prioridade: "media", responsavel: "meu", due_date: "" });
    }
  }, [task, open, user.id]);

  const socioId = admins.find((a) => a.id !== user.id)?.id ?? null;

  const save = useMutation({
    mutationFn: async () => {
      const responsavel_id = form.responsavel === "meu" ? user.id : form.responsavel === "socio" ? socioId : null;
      const responsavel_ambos = form.responsavel === "ambos";
      const payload = {
        titulo: form.titulo, descricao: form.descricao || null,
        status: form.status, prioridade: form.prioridade,
        responsavel_id, responsavel_ambos,
        due_date: form.due_date || null,
        completed_at: form.status === "feito" ? new Date().toISOString() : null,
      };
      if (task) {
        const { error } = await supabase.from("partner_tasks").update({ ...payload, updated_by: user.id }).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partner_tasks").insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      qc.invalidateQueries({ queryKey: ["partner_tasks"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as PTask["prioridade"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PTask["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Responsável</Label>
              <Select value={form.responsavel} onValueChange={(v) => setForm({ ...form, responsavel: v as typeof form.responsavel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meu">Eu</SelectItem>
                  <SelectItem value="socio" disabled={!socioId}>Meu sócio</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                  <SelectItem value="nenhum">Ninguém</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Prazo</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.titulo || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* NOTAS & IDEIAS                                                     */
/* ================================================================== */

type PNote = {
  id: string;
  tipo: "nota" | "ideia";
  titulo: string | null;
  conteudo: string;
  status: "nova" | "avaliando" | "aprovada" | "descartada" | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function NotasSection() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"nota" | "ideia">("nota");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PNote | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["partner_notes", tab],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_notes").select("*").eq("tipo", tab).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PNote[];
    },
  });
  const { data: authors = {} } = useAuthors(items.map((i) => i.created_by));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["partner_notes"] }); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PNote["status"] }) => {
      const { error } = await supabase.from("partner_notes").update({ status, updated_by: user.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner_notes"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border/60 bg-card/40 p-0.5">
          <button onClick={() => setTab("nota")}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", tab === "nota" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <StickyNote className="size-3.5" /> Notas
          </button>
          <button onClick={() => setTab("ideia")}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", tab === "ideia" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <Lightbulb className="size-3.5" /> Ideias
          </button>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> {tab === "nota" ? "Nova nota" : "Nova ideia"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum registro por aqui ainda.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((n) => (
            <Card key={n.id} className="border-border/60">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{n.titulo || "(sem título)"}</p>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{n.conteudo}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => { setEditing(n); setOpen(true); }}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => del.mutate(n.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                {n.tipo === "ideia" && (
                  <Select value={n.status ?? "nova"} onValueChange={(v) => updateStatus.mutate({ id: n.id, status: v as PNote["status"] })}>
                    <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="avaliando">Avaliando</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="descartada">Descartada</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  <AuthorChip author={authors[n.created_by]} label="por" />
                  <span className="text-[10px] text-muted-foreground">{format(parseISO(n.updated_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteDialog open={open} onOpenChange={setOpen} note={editing} tipo={tab} />
    </div>
  );
}

function NoteDialog({
  open, onOpenChange, note, tipo,
}: { open: boolean; onOpenChange: (v: boolean) => void; note: PNote | null; tipo: "nota" | "ideia" }) {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const [form, setForm] = useState({ titulo: "", conteudo: "", status: "nova" as NonNullable<PNote["status"]> });

  useMemo(() => {
    if (note) setForm({ titulo: note.titulo ?? "", conteudo: note.conteudo, status: (note.status ?? "nova") as NonNullable<PNote["status"]> });
    else if (open) setForm({ titulo: "", conteudo: "", status: "nova" });
  }, [note, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        tipo, titulo: form.titulo || null, conteudo: form.conteudo,
        status: tipo === "ideia" ? form.status : null,
      };
      if (note) {
        const { error } = await supabase.from("partner_notes").update({ ...payload, updated_by: user.id }).eq("id", note.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partner_notes").insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(note ? "Atualizado" : "Criado");
      qc.invalidateQueries({ queryKey: ["partner_notes"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{note ? "Editar" : "Novo"} {tipo === "nota" ? "nota" : "ideia"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Conteúdo</Label>
            <Textarea rows={6} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
          </div>
          {tipo === "ideia" && (
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as NonNullable<PNote["status"]> })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="avaliando">Avaliando</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="descartada">Descartada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.conteudo || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}