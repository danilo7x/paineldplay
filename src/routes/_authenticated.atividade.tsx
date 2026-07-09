import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Activity,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "@/routes/_authenticated";
import { currentSessionKey } from "@/lib/session-tracker";

export const Route = createFileRoute("/_authenticated/atividade")({
  component: AtividadePage,
});

type ActivityRow = {
  id: string;
  actor_id: string | null;
  acao: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: any;
  created_at: string;
  severity?: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  session_key: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
};

type Profile = { id: string; nome: string | null; email: string | null; avatar_url: string | null };

const ENTITY_LABEL: Record<string, string> = {
  projeto: "Projeto",
  venda: "Venda",
  despesa: "Despesa",
  aviso: "Aviso",
  membro: "Membro",
  etapa: "Etapa",
};

const ACTION_LABEL: Record<string, string> = {
  criou: "criou",
  editou: "editou",
  excluiu: "excluiu",
  mudou_status: "mudou o status de",
  adicionou_membro: "adicionou um membro em",
  mudou_papel: "trocou o papel de",
  ativou: "reativou",
  desativou: "desativou",
};

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  critical: {
    label: "Crítico",
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
  warn: {
    label: "Atenção",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  info: { label: "Info", className: "" },
};

function DeviceIcon({ type }: { type: string | null }) {
  const t = type ?? "desktop";
  if (t === "mobile") return <Smartphone className="size-4" />;
  if (t === "tablet") return <Tablet className="size-4" />;
  return <Monitor className="size-4" />;
}

function AtividadePage() {
  const { user, isAdmin } = AuthRoute.useRouteContext();
  const [entityFilter, setEntityFilter] = useState<string>("todos");
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [severityFilter, setSeverityFilter] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const sessionKey = currentSessionKey();
  const queryClient = useQueryClient();

  // Reset page whenever filters change
  useEffect(() => {
    setPage(0);
  }, [entityFilter, periodFilter, severityFilter]);

  const activitiesQuery = useQuery({
    queryKey: ["activity_logs", entityFilter, periodFilter, severityFilter, page],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(periodFilter));
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("activity_logs")
        .select("*", { count: "exact" })
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .range(from, to);
      if (entityFilter !== "todos") q = q.eq("entity_type", entityFilter);
      if (severityFilter !== "todos") q = q.eq("severity", severityFilter);
      const { data, count } = await q;
      return { rows: (data ?? []) as ActivityRow[], total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ["user_sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_sessions")
        .select("*")
        .order("last_active_at", { ascending: false });
      return (data ?? []) as SessionRow[];
    },
    staleTime: 30_000,
  });

  const activities = activitiesQuery.data?.rows ?? [];
  const totalActivities = activitiesQuery.data?.total ?? 0;
  const sessions = sessionsQuery.data ?? [];
  const loading = activitiesQuery.isLoading;

  const profilesQuery = useQuery({
    queryKey: [
      "activity_profiles",
      activities.map((a) => a.actor_id).filter(Boolean).sort().join(","),
      sessions.map((s) => s.user_id).sort().join(","),
    ],
    enabled: activities.length + sessions.length > 0,
    queryFn: async () => {
      const ids = new Set<string>();
      activities.forEach((a) => a.actor_id && ids.add(a.actor_id));
      sessions.forEach((s) => ids.add(s.user_id));
      if (!ids.size) return {} as Record<string, Profile>;
      const { data } = await supabase
        .from("profiles")
        .select("id,nome,email,avatar_url")
        .in("id", Array.from(ids));
      const map: Record<string, Profile> = {};
      data?.forEach((p) => (map[p.id] = p as Profile));
      return map;
    },
    staleTime: 60_000,
  });
  const profiles = profilesQuery.data ?? {};

  const mySessions = useMemo(
    () => sessions.filter((s) => s.user_id === user.id),
    [sessions, user.id],
  );
  const teamSessions = useMemo(
    () => sessions.filter((s) => s.user_id !== user.id),
    [sessions, user.id],
  );

  async function endOtherSessions() {
    if (!confirm("Encerrar todas as outras sessões? Você continuará conectado neste dispositivo.")) return;
    // Remove records other than current
    await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", user.id)
      .neq("session_key", sessionKey ?? "");
    // Sign out globally then re-sign this session (best-effort: only remove records here)
    try {
      await supabase.auth.signOut({ scope: "others" as any });
    } catch {}
    toast.success("Outras sessões encerradas");
    queryClient.invalidateQueries({ queryKey: ["user_sessions"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Atividade</h1>
        <p className="text-sm text-muted-foreground">
          Ações registradas e dispositivos conectados.
        </p>
      </div>

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feed">
            <Activity className="mr-2 size-4" /> Feed
          </TabsTrigger>
          <TabsTrigger value="dispositivos">
            <Monitor className="mr-2 size-4" /> Meus dispositivos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="equipe">
              <ShieldCheck className="mr-2 size-4" /> Sessões da equipe
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-9 w-[180px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as entidades</SelectItem>
                {Object.entries(ENTITY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-9 w-[160px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-9 w-[160px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda severidade</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="warn">Atenção</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma atividade no período.
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {activities.map((a) => {
                    const p = a.actor_id ? profiles[a.actor_id] : null;
                    const name = p?.nome || p?.email || "Sistema";
                    const initials = (name ?? "?").slice(0, 2).toUpperCase();
                    return (
                      <li key={a.id} className="flex items-start gap-3 p-4">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                          {p?.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="size-9 rounded-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{name}</span>{" "}
                            <span className="text-muted-foreground">
                              {ACTION_LABEL[a.acao] ?? a.acao}
                            </span>{" "}
                            <Badge variant="secondary" className="ml-1 rounded-full text-[10px]">
                              {ENTITY_LABEL[a.entity_type] ?? a.entity_type}
                            </Badge>{" "}
                            <span className="font-medium">{a.entity_name ?? ""}</span>
                          </p>
                          {a.severity && a.severity !== "info" && (
                            <Badge
                              variant="outline"
                              className={`mt-1 rounded-full border text-[10px] ${SEVERITY_META[a.severity]?.className ?? ""}`}
                            >
                              {SEVERITY_META[a.severity]?.label ?? a.severity}
                            </Badge>
                          )}
                          {a.details && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {typeof a.details === "object"
                                ? Object.entries(a.details)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(" · ")
                                : String(a.details)}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          {totalActivities > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Página {page + 1} de {Math.max(1, Math.ceil(totalActivities / PAGE_SIZE))}
                {" · "}
                {totalActivities} registros
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || activitiesQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    (page + 1) * PAGE_SIZE >= totalActivities ||
                    activitiesQuery.isFetching
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dispositivos" className="space-y-4">
          <div className="flex justify-end">
            {mySessions.length > 1 && (
              <Button variant="outline" size="sm" onClick={endOtherSessions}>
                <LogOut className="mr-2 size-4" /> Encerrar outras sessões
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {mySessions.map((s) => (
              <SessionCard key={s.id} s={s} current={s.session_key === sessionKey} />
            ))}
            {mySessions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
            )}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="equipe" className="space-y-3">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Sessões ativas na equipe</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/40">
                  {teamSessions.map((s) => {
                    const p = profiles[s.user_id];
                    return (
                      <li key={s.id} className="flex items-center gap-3 p-4">
                        <DeviceIcon type={s.device_type} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p?.nome || p?.email || s.user_id.slice(0, 8)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.device_name || `${s.browser ?? ""} · ${s.os ?? ""}`}
                            {s.ip_address ? ` · ${s.ip_address}` : ""}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </li>
                    );
                  })}
                  {teamSessions.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">Sem outras sessões.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SessionCard({ s, current }: { s: SessionRow; current: boolean }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <DeviceIcon type={s.device_type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{s.device_name || `${s.browser ?? ""} · ${s.os ?? ""}`}</p>
            {current && <Badge className="rounded-full text-[10px]">Este dispositivo</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.browser ?? "—"} · {s.os ?? "—"}
            {s.ip_address ? ` · IP ${s.ip_address}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Último acesso {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}