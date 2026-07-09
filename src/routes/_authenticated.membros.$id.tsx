import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail, Briefcase, Clock, ListChecks, FolderKanban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Role = "admin" | "staff" | "contador";
const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  staff: "Colaborador",
  contador: "Contadora",
};
const ROLE_CLASS: Record<Role, string> = {
  admin: "bg-primary/20 text-primary hover:bg-primary/30",
  staff: "",
  contador: "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30",
};

type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
  cargo: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  ativo: boolean;
};

type Project = {
  id: string;
  nome: string;
  status: string | null;
};

type ActivityRow = {
  id: string;
  acao: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-primary/20 text-primary" },
  pausado: { label: "Pausado", className: "bg-amber-500/20 text-amber-300" },
  concluido: { label: "Concluído", className: "bg-emerald-500/20 text-emerald-300" },
  arquivado: { label: "Arquivado", className: "bg-muted text-muted-foreground" },
};

const ACTION_LABEL: Record<string, string> = {
  criou: "criou",
  atualizou: "atualizou",
  mudou_status: "mudou o status de",
  excluiu: "excluiu",
  adicionou_membro: "adicionou membro em",
  ativou: "ativou",
  desativou: "desativou",
  mudou_papel: "mudou o papel de",
};
const ENTITY_LABEL: Record<string, string> = {
  projeto: "projeto",
  etapa: "etapa",
  venda: "venda",
  despesa: "despesa",
  aviso: "aviso",
  membro: "membro",
  usuario: "usuário",
};

export const Route = createFileRoute("/_authenticated/membros/$id")({
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stepsDone, setStepsDone] = useState<number>(0);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, nome, email, cargo, bio, avatar_url, cover_url, ativo")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (profErr || !prof) {
        setNotFoundFlag(true);
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      const [
        { data: roleRow },
        { data: sess },
        { data: memberships },
        { count: doneCount },
        { data: acts },
      ] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
        supabase
          .from("user_sessions")
          .select("last_active_at")
          .eq("user_id", id)
          .order("last_active_at", { ascending: false })
          .limit(1),
        supabase.from("project_members").select("project_id").eq("user_id", id),
        supabase
          .from("project_steps")
          .select("id", { count: "exact", head: true })
          .eq("autor_id", id)
          .eq("status", "concluido"),
        supabase
          .from("activity_logs")
          .select("id, acao, entity_type, entity_name, created_at")
          .eq("actor_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;
      setRole((roleRow?.role as Role) ?? null);
      setLastAccess(Array.isArray(sess) && sess[0]?.last_active_at ? sess[0].last_active_at : null);
      setStepsDone(doneCount ?? 0);
      setActivities((acts ?? []) as ActivityRow[]);

      const projIds = (memberships ?? []).map((m) => m.project_id);
      if (projIds.length > 0) {
        // RLS filters: only projects the current viewer can also see are returned.
        const { data: projs } = await supabase
          .from("projects")
          .select("id, nome, status")
          .in("id", projIds)
          .order("updated_at", { ascending: false });
        if (!cancelled) setProjects((projs ?? []) as Project[]);
      } else {
        setProjects([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (notFoundFlag || !profile) {
    throw notFound();
  }

  const isSelf = profile.id === user.id;
  const initial = (profile.nome ?? profile.email ?? "?")[0]?.toUpperCase();
  const visibleProjects = projects.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
          <Link to="/equipe">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
        {isSelf && (
          <Button asChild size="sm" variant="outline">
            <Link to="/perfil">Editar meu perfil</Link>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur">
        <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-background sm:h-44">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <CardContent className="p-4 sm:p-6">
          <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
            <Avatar className="size-20 border-4 border-card sm:size-24">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.nome ?? ""} />
              <AvatarFallback className="bg-primary/20 text-xl font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {profile.nome ?? "—"}
                </h1>
                {role && (
                  <Badge
                    variant={role === "admin" ? "default" : "secondary"}
                    className={ROLE_CLASS[role]}
                  >
                    {ROLE_LABEL[role]}
                  </Badge>
                )}
                {!profile.ativo && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    Inativo
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {profile.cargo && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="size-3.5" />
                    {profile.cargo}
                  </span>
                )}
                {profile.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3.5" />
                    <span className="truncate">{profile.email}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {lastAccess
                    ? `Último acesso ${formatDistanceToNow(new Date(lastAccess), { addSuffix: true, locale: ptBR })}`
                    : "Nunca acessou"}
                </span>
              </div>
            </div>
          </div>
          {profile.bio && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{profile.bio}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<FolderKanban className="size-4" />}
          label="Projetos"
          value={visibleProjects}
        />
        <StatCard
          icon={<ListChecks className="size-4" />}
          label="Etapas concluídas"
          value={stepsDone}
        />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Atividades recentes"
          value={activities.length}
        />
      </div>

      <Card className="border-border/50 bg-card/60 backdrop-blur">
        <CardContent className="space-y-3 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Projetos
            </h2>
            <span className="text-xs text-muted-foreground">{visibleProjects}</span>
          </div>
          {projects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum projeto compartilhado com você.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {projects.map((p) => {
                const meta = STATUS_META[p.status ?? "ativo"] ?? STATUS_META.ativo;
                return (
                  <li key={p.id}>
                    <Link
                      to="/projetos/$id"
                      params={{ id: p.id }}
                      className="flex items-center justify-between gap-3 py-3 hover:opacity-90"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nome}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/60 backdrop-blur">
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Atividades recentes
          </h2>
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nada por aqui ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {activities.map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <p className="min-w-0">
                    <span className="text-muted-foreground">
                      {ACTION_LABEL[a.acao] ?? a.acao}
                    </span>{" "}
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {ENTITY_LABEL[a.entity_type] ?? a.entity_type}
                    </Badge>{" "}
                    <span className="font-medium">{a.entity_name ?? ""}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="uppercase tracking-widest">{label}</span>
          <span className="text-primary">{icon}</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}