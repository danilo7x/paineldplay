import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PROJECT_STATUS_META,
  STEP_STATUS_META,
  type ProjectStatus,
  type ProjectStepStatus,
} from "@/features/projects/status";

type Project = {
  id: string;
  nome: string;
  cliente: string | null;
  descricao: string | null;
  status: ProjectStatus;
};
type MemberProfile = { id: string; nome: string | null; email: string | null; avatar_url: string | null };
type Step = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: ProjectStepStatus;
  ordem: number;
  autor_id: string | null;
  created_at: string;
};
type Note = { id: string; conteudo: string; autor_id: string | null; created_at: string };
type Credential = {
  id: string;
  nome_acesso: string;
  login: string | null;
  senha: string | null;
  url: string | null;
  notas: string | null;
};

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user, isAdmin } = Route.useRouteContext();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [team, setTeam] = useState<MemberProfile[]>([]);
  const [salesSummary, setSalesSummary] = useState<{ total: number; count: number; pago: number }>({
    total: 0,
    count: 0,
    pago: 0,
  });
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const [projRes, membersRes, stepsRes, notesRes, credsRes, teamRes] = await Promise.all([
      supabase.from("projects").select("id, nome, cliente, descricao, status").eq("id", id).maybeSingle(),
      supabase.from("project_members").select("user_id").eq("project_id", id),
      supabase.from("project_steps").select("*").eq("project_id", id).order("ordem"),
      supabase.from("project_notes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_credentials").select("*").eq("project_id", id).order("created_at"),
      supabase.from("profiles").select("id, nome, email, avatar_url").eq("ativo", true).order("nome"),
    ]);
    const salesRes = await supabase
      .from("sales")
      .select("valor, status")
      .eq("project_id", id);
    const salesRows = (salesRes.data ?? []) as { valor: number; status: string }[];
    setSalesSummary({
      count: salesRows.length,
      total: salesRows.reduce((s, r) => s + Number(r.valor ?? 0), 0),
      pago: salesRows
        .filter((r) => r.status === "pago")
        .reduce((s, r) => s + Number(r.valor ?? 0), 0),
    });
    if (projRes.error || !projRes.data) {
      toast.error("Projeto não encontrado ou sem acesso");
      setLoading(false);
      return;
    }
    const teamData = (teamRes.data ?? []) as MemberProfile[];
    const memberIds = new Set((membersRes.data ?? []).map((m) => m.user_id));
    setProject(projRes.data);
    setMembers(teamData.filter((p) => memberIds.has(p.id)));
    setSteps((stepsRes.data ?? []) as Step[]);
    setNotes((notesRes.data ?? []) as Note[]);
    setCreds((credsRes.data ?? []) as Credential[]);
    setTeam(teamData);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isMember = useMemo(() => members.some((m) => m.id === user.id), [members, user.id]);
  const canEditContent = isAdmin || isMember;
  const authorMap = useMemo(() => {
    const map = new Map<string, MemberProfile>();
    [...members, ...team].forEach((p) => map.set(p.id, p));
    return map;
  }, [members, team]);

  const pct = steps.length === 0 ? 0 : Math.round((steps.filter((s) => s.status === "concluido").length / steps.length) * 100);

  async function updateStatus(newStatus: ProjectStatus) {
    if (!project) return;
    const { error } = await supabase.from("projects").update({ status: newStatus }).eq("id", project.id);
    if (error) return toast.error("Erro ao atualizar", { description: error.message });
    setProject({ ...project, status: newStatus });
    toast.success("Status atualizado");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Projeto indisponível.
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/projetos">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const meta = PROJECT_STATUS_META[project.status];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/projetos"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Projetos
        </Link>
      </div>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="space-y-5 p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {project.cliente ?? "Sem cliente"}
              </p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {project.nome}
              </h1>
              {project.descricao && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.descricao}</p>
              )}
            </div>
            <div className="shrink-0">
              {isAdmin ? (
                <Select value={project.status} onValueChange={(v) => updateStatus(v as ProjectStatus)}>
                  <SelectTrigger className={`h-8 rounded-full border-0 px-3 text-xs ${meta.className}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROJECT_STATUS_META) as ProjectStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {PROJECT_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                  {meta.label}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex -space-x-2">
              {members.slice(0, 6).map((m) => (
                <Avatar key={m.id} className="size-8 border-2 border-card">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                    {(m.nome ?? m.email ?? "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length === 0 && (
                <span className="text-xs text-muted-foreground">Sem membros ainda</span>
              )}
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{pct}% concluído</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Faturamento do projeto
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                salesSummary.total,
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {salesSummary.count} venda{salesSummary.count === 1 ? "" : "s"} · pago{" "}
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                salesSummary.pago,
              )}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/faturamento" search={{ project: project.id }}>
              Ver vendas
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="progresso">
        <TabsList className="rounded-full bg-card/60">
          <TabsTrigger value="progresso" className="rounded-full">
            Progresso
          </TabsTrigger>
          <TabsTrigger value="notas" className="rounded-full">
            Notas
          </TabsTrigger>
          <TabsTrigger value="credenciais" className="rounded-full">
            Credenciais
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="membros" className="rounded-full">
              Membros
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="progresso" className="mt-4">
          <ProgressTab
            projectId={project.id}
            steps={steps}
            authorMap={authorMap}
            canEdit={canEditContent}
            currentUserId={user.id}
            onChange={fetchAll}
          />
        </TabsContent>
        <TabsContent value="notas" className="mt-4">
          <NotesTab
            projectId={project.id}
            notes={notes}
            authorMap={authorMap}
            canEdit={canEditContent}
            currentUserId={user.id}
            isAdmin={isAdmin}
            onChange={fetchAll}
          />
        </TabsContent>
        <TabsContent value="credenciais" className="mt-4">
          <CredentialsTab
            projectId={project.id}
            creds={creds}
            isAdmin={isAdmin}
            onChange={fetchAll}
          />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="membros" className="mt-4">
            <MembersTab
              projectId={project.id}
              members={members}
              team={team}
              onChange={fetchAll}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ----------------------------- Progresso ----------------------------- */
function ProgressTab({
  projectId,
  steps,
  authorMap,
  canEdit,
  currentUserId,
  onChange,
}: {
  projectId: string;
  steps: Step[];
  authorMap: Map<string, MemberProfile>;
  canEdit: boolean;
  currentUserId: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);

  async function setStatus(step: Step, status: ProjectStepStatus) {
    const { error } = await supabase.from("project_steps").update({ status }).eq("id", step.id);
    if (error) return toast.error("Erro", { description: error.message });
    onChange();
  }

  async function move(step: Step, dir: -1 | 1) {
    const idx = steps.findIndex((s) => s.id === step.id);
    const swap = steps[idx + dir];
    if (!swap) return;
    const { error: e1 } = await supabase.from("project_steps").update({ ordem: swap.ordem }).eq("id", step.id);
    const { error: e2 } = await supabase.from("project_steps").update({ ordem: step.ordem }).eq("id", swap.id);
    if (e1 || e2) return toast.error("Erro ao reordenar");
    onChange();
  }

  async function remove(step: Step) {
    const { error } = await supabase.from("project_steps").delete().eq("id", step.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Etapa removida");
    onChange();
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-xl">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Timeline
          </h2>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="size-3.5" /> Adicionar etapa
                </Button>
              </DialogTrigger>
              <NewStepDialog
                projectId={projectId}
                nextOrder={(steps.at(-1)?.ordem ?? 0) + 1}
                onCreated={() => {
                  setOpen(false);
                  onChange();
                }}
              />
            </Dialog>
          )}
        </div>

        {steps.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma etapa registrada ainda.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-border/50 pl-6">
            {steps.map((s, idx) => {
              const meta = STEP_STATUS_META[s.status];
              const author = s.autor_id ? authorMap.get(s.autor_id) : null;
              return (
                <li key={s.id} className="relative">
                  <span
                    className={`absolute -left-[29px] top-1.5 grid size-4 place-items-center rounded-full ring-2 ring-background ${meta.dot}`}
                  >
                    {s.status === "concluido" && <Check className="size-2.5 text-background" />}
                  </span>
                  <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.titulo}</p>
                        {s.descricao && (
                          <p className="mt-1 text-xs text-muted-foreground">{s.descricao}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className={`rounded-full px-2 py-0.5 ${meta.className}`}>
                            {meta.label}
                          </span>
                          {author && <span>por {author.nome ?? author.email}</span>}
                          <span>· {new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <Select
                            value={s.status}
                            onValueChange={(v) => setStatus(s, v as ProjectStepStatus)}
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STEP_STATUS_META) as ProjectStepStatus[]).map((v) => (
                                <SelectItem key={v} value={v}>
                                  {STEP_STATUS_META[v].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={idx === 0}
                            onClick={() => move(s, -1)}
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={idx === steps.length - 1}
                            onClick={() => move(s, 1)}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                          {s.autor_id === currentUserId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => remove(s)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function NewStepDialog({
  projectId,
  nextOrder,
  onCreated,
}: {
  projectId: string;
  nextOrder: number;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<ProjectStepStatus>("pendente");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("project_steps").insert({
      project_id: projectId,
      titulo,
      descricao: descricao || null,
      status,
      ordem: nextOrder,
      autor_id: sess.session?.user.id,
    });
    setLoading(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Etapa adicionada");
    setTitulo("");
    setDescricao("");
    setStatus("pendente");
    onCreated();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Adicionar etapa</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStepStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STEP_STATUS_META) as ProjectStepStatus[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {STEP_STATUS_META[v].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}Adicionar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ------------------------------- Notas ------------------------------- */
function NotesTab({
  projectId,
  notes,
  authorMap,
  canEdit,
  currentUserId,
  isAdmin,
  onChange,
}: {
  projectId: string;
  notes: Note[];
  authorMap: Map<string, MemberProfile>;
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [conteudo, setConteudo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!conteudo.trim()) return;
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("project_notes").insert({
      project_id: projectId,
      conteudo,
      autor_id: sess.session?.user.id,
    });
    setLoading(false);
    if (error) return toast.error("Erro", { description: error.message });
    setConteudo("");
    onChange();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    onChange();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-xl">
          <CardContent className="p-4">
            <form onSubmit={submit} className="space-y-3">
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Escreva uma nota sobre o projeto…"
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={loading} className="gap-2">
                  {loading && <Loader2 className="size-3.5 animate-spin" />}Adicionar nota
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {notes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sem anotações ainda.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const author = n.autor_id ? authorMap.get(n.autor_id) : null;
            const canDelete = isAdmin || n.autor_id === currentUserId;
            return (
              <Card key={n.id} className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-xl">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={author?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                          {(author?.nome ?? author?.email ?? "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium">{author?.nome ?? author?.email ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(n.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{n.conteudo}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Credenciais ---------------------------- */
function CredentialsTab({
  projectId,
  creds,
  isAdmin,
  onChange,
}: {
  projectId: string;
  creds: Credential[];
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  async function remove(id: string) {
    const { error } = await supabase.from("project_credentials").delete().eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Credencial removida");
    onChange();
  }

  function copy(v: string | null | undefined, label: string) {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-3.5" /> Nova credencial
              </Button>
            </DialogTrigger>
            <NewCredDialog
              projectId={projectId}
              onCreated={() => {
                setOpen(false);
                onChange();
              }}
            />
          </Dialog>
        </div>
      )}
      {creds.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma credencial cadastrada.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {creds.map((c) => (
            <Card
              key={c.id}
              className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-xl"
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.nome_acesso}</p>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[11px] text-primary hover:underline"
                      >
                        {c.url}
                      </a>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(c.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <FieldRow label="Login" value={c.login} onCopy={() => copy(c.login, "Login")} />
                  <FieldRow
                    label="Senha"
                    value={c.senha ? (reveal[c.id] ? c.senha : "••••••••") : null}
                    onCopy={() => copy(c.senha, "Senha")}
                    onToggle={
                      c.senha ? () => setReveal((r) => ({ ...r, [c.id]: !r[c.id] })) : undefined
                    }
                    revealed={!!reveal[c.id]}
                  />
                </div>
                {c.notas && (
                  <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
                    {c.notas}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onCopy,
  onToggle,
  revealed,
}: {
  label: string;
  value: string | null;
  onCopy: () => void;
  onToggle?: () => void;
  revealed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{value ?? "—"}</p>
      </div>
      <div className="flex items-center gap-1">
        {onToggle && (
          <Button size="icon" variant="ghost" className="size-6" onClick={onToggle}>
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={onCopy}
          disabled={!value}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NewCredDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [nomeAcesso, setNomeAcesso] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [url, setUrl] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("project_credentials").insert({
      project_id: projectId,
      nome_acesso: nomeAcesso,
      login: login || null,
      senha: senha || null,
      url: url || null,
      notas: notas || null,
    });
    setLoading(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Credencial adicionada");
    setNomeAcesso("");
    setLogin("");
    setSenha("");
    setUrl("");
    setNotas("");
    onCreated();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Nova credencial</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Nome do acesso</Label>
          <Input value={nomeAcesso} onChange={(e) => setNomeAcesso(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Login</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}Adicionar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ------------------------------ Membros ------------------------------ */
function MembersTab({
  projectId,
  members,
  team,
  onChange,
}: {
  projectId: string;
  members: MemberProfile[];
  team: MemberProfile[];
  onChange: () => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const available = team.filter((t) => !members.some((m) => m.id === t.id));

  async function add() {
    if (!selected) return;
    setLoading(true);
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: selected });
    setLoading(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Membro adicionado");
    setSelected("");
    onChange();
  }

  async function remove(userId: string) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) return toast.error("Erro", { description: error.message });
    onChange();
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-xl">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Adicionar colaborador
            </Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione da equipe…" />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Toda a equipe já participa.
                  </div>
                )}
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome ?? t.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!selected || loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem membros.</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                      {(m.nome ?? m.email ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{m.nome ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(m.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}