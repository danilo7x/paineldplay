import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderKanban, Loader2, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { PROJECT_STATUS_META, type ProjectStatus } from "@/features/projects/status";

type MemberProfile = { id: string; nome: string | null; avatar_url: string | null };
type ProjectRow = {
  id: string;
  nome: string;
  cliente: string | null;
  status: ProjectStatus;
  members: MemberProfile[];
  totalSteps: number;
  doneSteps: number;
};

export const Route = createFileRoute("/_authenticated/projetos/")({
  component: ProjetosIndex,
});

function ProjetosIndex() {
  const { isAdmin } = Route.useRouteContext();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function fetchProjects() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("projects")
      .select("id, nome, cliente, status")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar projetos", { description: error.message });
      setLoading(false);
      return;
    }
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const [membersRes, stepsRes] = await Promise.all([
      supabase.from("project_members").select("project_id, user_id").in("project_id", ids),
      supabase.from("project_steps").select("project_id, status").in("project_id", ids),
    ]);

    const userIds = Array.from(new Set((membersRes.data ?? []).map((m) => m.user_id)));
    const profilesRes = userIds.length
      ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds)
      : { data: [] as MemberProfile[] };
    const profileMap = new Map<string, MemberProfile>();
    (profilesRes.data ?? []).forEach((p) => profileMap.set(p.id, p as MemberProfile));

    const membersByProject = new Map<string, MemberProfile[]>();
    (membersRes.data ?? []).forEach((m) => {
      const arr = membersByProject.get(m.project_id) ?? [];
      const p = profileMap.get(m.user_id);
      if (p) arr.push(p);
      membersByProject.set(m.project_id, arr);
    });

    const stepsByProject = new Map<string, { total: number; done: number }>();
    (stepsRes.data ?? []).forEach((s: any) => {
      const cur = stepsByProject.get(s.project_id) ?? { total: 0, done: 0 };
      cur.total++;
      if (s.status === "concluido") cur.done++;
      stepsByProject.set(s.project_id, cur);
    });

    setProjects(
      rows!.map((r) => ({
        ...r,
        members: membersByProject.get(r.id) ?? [],
        totalSteps: stepsByProject.get(r.id)?.total ?? 0,
        doneSteps: stepsByProject.get(r.id)?.done ?? 0,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Todos os projetos da DPlay Solutions."
              : "Projetos em que você participa."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Novo projeto
              </Button>
            </DialogTrigger>
            <NewProjectDialog
              onCreated={() => {
                setOpen(false);
                fetchProjects();
              }}
            />
          </Dialog>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/60 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <FolderKanban className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Nenhum projeto ainda. Crie o primeiro."
                : "Você ainda não faz parte de nenhum projeto."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const pct = p.totalSteps === 0 ? 0 : Math.round((p.doneSteps / p.totalSteps) * 100);
            const meta = PROJECT_STATUS_META[p.status];
            return (
              <Link
                key={p.id}
                to="/projetos/$id"
                params={{ id: p.id }}
                className="group block"
              >
                <Card className="h-full rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl transition group-hover:border-primary/40 group-hover:shadow-[0_10px_40px_-12px_rgba(5,126,243,0.35)]">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{p.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.cliente ?? "Sem cliente definido"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-auto space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                          <span>Progresso</span>
                          <span>
                            {p.doneSteps}/{p.totalSteps} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {p.members.slice(0, 4).map((m) => (
                            <Avatar
                              key={m.id}
                              className="size-7 border-2 border-card ring-0"
                            >
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                                {(m.nome ?? "?")[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {p.members.length > 4 && (
                            <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] text-muted-foreground">
                              +{p.members.length - 4}
                            </div>
                          )}
                          {p.members.length === 0 && (
                            <span className="text-[10px] text-muted-foreground">Sem membros</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("em_desenvolvimento");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    const { error } = await supabase.from("projects").insert({
      nome,
      cliente: cliente || null,
      descricao: descricao || null,
      status,
      created_by: userId,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar", { description: error.message });
      return;
    }
    toast.success("Projeto criado");
    onCreated();
    setNome("");
    setCliente("");
    setDescricao("");
    setStatus("em_desenvolvimento");
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Novo projeto</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-nome">Nome</Label>
          <Input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-cliente">Cliente</Label>
          <Input id="p-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Descrição</Label>
          <Textarea
            id="p-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
            <SelectTrigger>
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
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Criar projeto
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}