import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MoreHorizontal,
  UserPlus,
  Loader2,
  Copy,
  KeyRound,
  MailPlus,
  Target,
  MessageCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmPasswordDialog } from "@/components/ConfirmPasswordDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "admin" | "staff" | "contador";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  staff: "Colaborador",
  contador: "Contadora",
};

type Member = {
  id: string;
  nome: string | null;
  email: string | null;
  cargo: string | null;
  avatar_url: string | null;
  ativo: boolean;
  role: Role | null;
  comercial: boolean;
  /** Instância da Evolution API (número de WhatsApp) desta pessoa. */
  whatsapp: string | null;
};

export const Route = createFileRoute("/_authenticated/equipe")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: EquipePage,
});

function EquipePage() {
  const { user } = Route.useRouteContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [whatsappMember, setWhatsappMember] = useState<Member | null>(null);
  const [lastAccess, setLastAccess] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: () => Promise<void>;
  } | null>(null);

  async function fetchMembers() {
    setLoading(true);
    const commercialReq = supabase.from("commercial_access").select("user_id");
    const whatsappReq = supabase.from("commercial_whatsapp_instances").select("user_id, instance");
    const [{ data: profiles, error }, { data: roles }, { data: sessions }] = await Promise.all([
      supabase
      .from("profiles")
      .select("id, nome, email, cargo, avatar_url, ativo")
        .order("nome", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("user_sessions")
        .select("user_id, last_active_at")
        .order("last_active_at", { ascending: false }),
    ]);
    const { data: commercial } = await commercialReq;
    const { data: whatsapp } = await whatsappReq;
    if (error) {
      toast.error("Erro ao carregar equipe", { description: error.message });
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    const accessMap: Record<string, string> = {};
    (sessions ?? []).forEach((s) => {
      if (!accessMap[s.user_id]) accessMap[s.user_id] = s.last_active_at;
    });
    setLastAccess(accessMap);
    const commercialIds = new Set((commercial ?? []).map((c) => c.user_id));
    const whatsappMap = new Map((whatsapp ?? []).map((w) => [w.user_id, w.instance]));
    setMembers(
      (profiles ?? []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? null,
        comercial: commercialIds.has(p.id),
        whatsapp: whatsappMap.get(p.id) ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  async function toggleAtivo(m: Member, ativo: boolean) {
    setConfirmAction({
      title: ativo ? "Ativar usuário" : "Desativar usuário",
      description: ativo
        ? `Confirme sua senha para reativar ${m.nome ?? m.email}.`
        : `Confirme sua senha para desativar ${m.nome ?? m.email}. Ele(a) não conseguirá mais acessar o sistema.`,
      confirmLabel: ativo ? "Ativar" : "Desativar",
      run: async () => {
        const { error } = await supabase.rpc("admin_set_user_ativo", {
          _user_id: m.id,
          _ativo: ativo,
        });
        if (error) {
          toast.error("Não foi possível alterar", { description: error.message });
          return;
        }
        toast.success(ativo ? "Usuário ativado" : "Usuário desativado");
        fetchMembers();
      },
    });
  }

  async function changeRole(m: Member, role: Role) {
    setConfirmAction({
      title: "Trocar papel",
      description: `Confirme sua senha para tornar ${m.nome ?? m.email} ${ROLE_LABEL[role]}.`,
      confirmLabel: "Trocar papel",
      run: async () => {
        const { error } = await supabase.rpc("admin_set_user_role", {
          _user_id: m.id,
          _role: role,
        });
        if (error) {
          toast.error("Não foi possível alterar papel", { description: error.message });
          return;
        }
        toast.success("Papel atualizado");
        fetchMembers();
      },
    });
  }

  async function toggleComercial(m: Member, enabled: boolean) {
    setConfirmAction({
      title: enabled ? "Liberar Acompanhamento de Leads" : "Remover acesso a Leads",
      description: enabled
        ? `Confirme sua senha para liberar ${m.nome ?? m.email} no Acompanhamento de Leads. Ele(a) verá apenas os leads atribuídos a ele(a).`
        : `Confirme sua senha para remover o acesso de ${m.nome ?? m.email} ao Acompanhamento de Leads.`,
      confirmLabel: enabled ? "Liberar" : "Remover",
      run: async () => {
        const { error } = await supabase.rpc("admin_set_commercial_access", {
          _user_id: m.id,
          _enabled: enabled,
        });
        if (error) {
          toast.error("Não foi possível alterar o acesso", { description: error.message });
          return;
        }
        toast.success(enabled ? "Acesso comercial liberado" : "Acesso comercial removido");
        fetchMembers();
      },
    });
  }
  function setWhatsapp(m: Member, instance: string | null) {
    setWhatsappMember(null);
    setConfirmAction({
      title: instance ? "Conectar WhatsApp" : "Remover WhatsApp",
      description: instance
        ? `Confirme sua senha para que as mensagens dos leads de ${m.nome ?? m.email} saiam da instância “${instance}” da Evolution API.`
        : `Confirme sua senha para desvincular o WhatsApp de ${m.nome ?? m.email}.`,
      confirmLabel: instance ? "Salvar" : "Remover",
      run: async () => {
        const { error } = await supabase.rpc("admin_set_whatsapp_instance", {
          _user_id: m.id,
          _instance: instance ?? "",
        });
        if (error) {
          toast.error("Não foi possível salvar", { description: error.message });
          return;
        }
        toast.success(instance ? "WhatsApp vinculado" : "WhatsApp removido");
        fetchMembers();
      },
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Administração</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie sócios e colaboradores da DPlay Solutions.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="size-4" /> Convidar colaborador
        </Button>
      </header>

      {/* Mobile: cards empilhados */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-4 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Nenhum colaborador ainda.
          </div>
        ) : (
          members.map((m) => {
            const isSelf = m.id === user.id;
            const last = lastAccess[m.id];
            return (
              <div
                key={m.id}
                className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Link
                    to="/membros/$id"
                    params={{ id: m.id }}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg -m-1 p-1 hover:bg-accent/40"
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={m.avatar_url ?? undefined} alt={m.nome ?? ""} />
                      <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                        {(m.nome ?? m.email ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.nome ?? "—"}
                        {isSelf && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                            você
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Papel</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={m.role === "admin"}
                        onClick={() => changeRole(m, "admin")}
                      >
                        Tornar admin
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={m.role === "staff"}
                        onClick={() => changeRole(m, "staff")}
                      >
                        Tornar colaborador
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={m.role === "contador"}
                        onClick={() => changeRole(m, "contador")}
                      >
                        Tornar contadora
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Comercial</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={m.role === "admin"}
                        onClick={() => toggleComercial(m, !m.comercial)}
                      >
                        <Target className="mr-2 size-4" />
                        {m.role === "admin"
                          ? "Admin já acessa os Leads"
                          : m.comercial
                            ? "Remover acesso a Leads"
                            : "Liberar Acompanhamento de Leads"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={m.role !== "admin" && !m.comercial}
                        onClick={() => setWhatsappMember(m)}
                      >
                        <MessageCircle className="mr-2 size-4" />
                        {m.whatsapp ? `WhatsApp: ${m.whatsapp}` : "WhatsApp (Evolution)…"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={isSelf}
                        onClick={() => toggleAtivo(m, !m.ativo)}
                      >
                        {m.ativo ? "Desativar" : "Ativar"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setResetMember(m)}>
                        <KeyRound className="mr-2 size-4" /> Redefinir senha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetMember(m)}>
                        <MailPlus className="mr-2 size-4" /> Reenviar convite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Cargo
                    </dt>
                    <dd className="truncate text-foreground/90">{m.cargo ?? "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Papel
                    </dt>
                    <dd>
                      <Badge
                        variant={m.role === "admin" ? "default" : "secondary"}
                        className={
                          m.role === "admin"
                            ? "bg-primary/20 text-primary hover:bg-primary/30"
                            : m.role === "contador"
                              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              : ""
                        }
                      >
                        {m.role ? ROLE_LABEL[m.role] : "—"}
                      </Badge>
                      {m.comercial && m.role !== "admin" && (
                        <Badge
                          variant="outline"
                          className="ml-1 border-primary/40 text-[10px] text-primary"
                        >
                          Comercial
                        </Badge>
                      )}
                      {m.whatsapp && (
                        <Badge
                          variant="outline"
                          className="ml-1 border-emerald-500/40 text-[10px] text-emerald-300"
                        >
                          WhatsApp: {m.whatsapp}
                        </Badge>
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Último acesso
                    </dt>
                    <dd className="truncate text-muted-foreground">
                      {last
                        ? formatDistanceToNow(new Date(last), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "Nunca"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Ativo
                    </dt>
                    <dd>
                      <Switch
                        checked={m.ativo}
                        disabled={isSelf}
                        onCheckedChange={(v) => toggleAtivo(m, v)}
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-xl border border-border/50 bg-card/50 backdrop-blur md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum colaborador ainda.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const isSelf = m.id === user.id;
                const last = lastAccess[m.id];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        to="/membros/$id"
                        params={{ id: m.id }}
                        className="flex items-center gap-3 rounded-lg -m-1 p-1 hover:bg-accent/40"
                      >
                        <Avatar className="size-9">
                          <AvatarImage src={m.avatar_url ?? undefined} alt={m.nome ?? ""} />
                          <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                            {(m.nome ?? m.email ?? "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {m.nome ?? "—"}
                            {isSelf && (
                              <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                                você
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.cargo ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={m.role === "admin" ? "default" : "secondary"}
                        className={
                          m.role === "admin"
                            ? "bg-primary/20 text-primary hover:bg-primary/30"
                            : m.role === "contador"
                              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              : ""
                        }
                      >
                        {m.role ? ROLE_LABEL[m.role] : "—"}
                      </Badge>
                      {m.comercial && m.role !== "admin" && (
                        <Badge
                          variant="outline"
                          className="ml-1 border-primary/40 text-[10px] text-primary"
                        >
                          Comercial
                        </Badge>
                      )}
                      {m.whatsapp && (
                        <Badge
                          variant="outline"
                          className="ml-1 border-emerald-500/40 text-[10px] text-emerald-300"
                        >
                          WhatsApp: {m.whatsapp}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {last ? (
                        <span title={new Date(last).toLocaleString("pt-BR")}>
                          {formatDistanceToNow(new Date(last), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">Nunca acessou</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={m.ativo}
                        disabled={isSelf}
                        onCheckedChange={(v) => toggleAtivo(m, v)}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Papel</DropdownMenuLabel>
                          <DropdownMenuItem
                            disabled={m.role === "admin"}
                            onClick={() => changeRole(m, "admin")}
                          >
                            Tornar admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={m.role === "staff"}
                            onClick={() => changeRole(m, "staff")}
                          >
                            Tornar colaborador
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={m.role === "contador"}
                            onClick={() => changeRole(m, "contador")}
                          >
                            Tornar contadora
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Comercial</DropdownMenuLabel>
                          <DropdownMenuItem
                            disabled={m.role === "admin"}
                            onClick={() => toggleComercial(m, !m.comercial)}
                          >
                            <Target className="mr-2 size-4" />
                            {m.role === "admin"
                              ? "Admin já acessa os Leads"
                              : m.comercial
                                ? "Remover acesso a Leads"
                                : "Liberar Acompanhamento de Leads"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={m.role !== "admin" && !m.comercial}
                            onClick={() => setWhatsappMember(m)}
                          >
                            <MessageCircle className="mr-2 size-4" />
                            {m.whatsapp ? `WhatsApp: ${m.whatsapp}` : "WhatsApp (Evolution)…"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isSelf}
                            onClick={() => toggleAtivo(m, !m.ativo)}
                          >
                            {m.ativo ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setResetMember(m)}>
                            <KeyRound className="mr-2 size-4" /> Redefinir senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetMember(m)}>
                            <MailPlus className="mr-2 size-4" /> Reenviar convite / redefinir acesso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={() => {
          fetchMembers();
        }}
      />

      <ResetPasswordDialog
        member={resetMember}
        onOpenChange={(v) => {
          if (!v) setResetMember(null);
        }}
      />

      <WhatsappInstanceDialog
        member={whatsappMember}
        onClose={() => setWhatsappMember(null)}
        onSave={setWhatsapp}
      />

      <ConfirmPasswordDialog
        open={!!confirmAction}
        onOpenChange={(v) => {
          if (!v) setConfirmAction(null);
        }}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirmar"}
        danger
        onConfirmed={async () => {
          await confirmAction?.run();
        }}
      />
    </div>
  );
}

function WhatsappInstanceDialog({
  member,
  onClose,
  onSave,
}: {
  member: Member | null;
  onClose: () => void;
  onSave: (m: Member, instance: string | null) => void;
}) {
  const [instance, setInstance] = useState("");
  useEffect(() => {
    if (member) setInstance(member.whatsapp ?? "");
  }, [member]);
  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>WhatsApp de {member?.nome ?? member?.email}</DialogTitle>
          <DialogDescription>
            Informe o nome da instância criada na Evolution API com o número desta pessoa. As
            mensagens dos leads em que ela é responsável saem desse número.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Nome da instância</Label>
          <Input
            value={instance}
            onChange={(e) => setInstance(e.target.value)}
            placeholder="ex.: danilo"
            autoCapitalize="none"
          />
          <p className="text-[11px] text-muted-foreground">
            Exatamente como aparece no painel da Evolution (maiúsculas e minúsculas contam).
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {member?.whatsapp ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => onSave(member, null)}
            >
              Remover
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!instance.trim() || instance.trim() === member?.whatsapp}
              onClick={() => member && onSave(member, instance.trim())}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function reset() {
    setNome("");
    setEmail("");
    setCargo("");
    setRole("staff");
    setPassword("");
    setTempPassword(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (password && password.length < 8) {
      toast.error("Senha muito curta", { description: "Mínimo 8 caracteres" });
      return;
    }
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          email,
          cargo: cargo || null,
          role,
          password: password || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao convidar");
      setTempPassword(json.tempPassword);
      toast.success("Colaborador criado");
      onCreated();
    } catch (err) {
      toast.error("Erro ao convidar", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar colaborador</DialogTitle>
          <DialogDescription>
            {tempPassword
              ? "Envie a senha temporária abaixo para o colaborador. Ela só será mostrada uma vez."
              : "Um usuário será criado com senha temporária."}
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 font-mono text-sm">
              {tempPassword}
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(tempPassword);
                toast.success("Senha copiada");
              }}
            >
              <Copy className="size-4" /> Copiar
            </Button>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Concluir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex: Designer, Dev"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha (opcional)</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para gerar automática"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres. Se vazio, uma senha aleatória será gerada.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Colaborador</SelectItem>
                  <SelectItem value="contador">Contadora</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Convidar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  member,
  onOpenChange,
}: {
  member: Member | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!member) {
      setPassword("");
      setResult(null);
      setLoading(false);
    }
  }, [member]);

  async function handleReset(e: React.FormEvent, useRandom: boolean) {
    e.preventDefault();
    if (!member) return;
    if (!useRandom && password.length < 8) {
      toast.error("Senha muito curta", { description: "Mínimo 8 caracteres" });
      return;
    }
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: member.id,
          password: useRandom ? undefined : password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao redefinir");
      setResult(json.tempPassword);
      toast.success("Senha redefinida");
    } catch (err) {
      toast.error("Erro ao redefinir", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            {result
              ? `Nova senha de ${member?.nome ?? member?.email}. Copie e envie ao colaborador — não será mostrada de novo.`
              : `Defina uma nova senha para ${member?.nome ?? member?.email} ou gere uma aleatória.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 font-mono text-sm">
              {result}
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(result);
                toast.success("Senha copiada");
              }}
            >
              <Copy className="size-4" /> Copiar
            </Button>
            <DialogFooter>
              <Button className="w-full" onClick={() => onOpenChange(false)}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => handleReset(e, false)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="submit"
                disabled={loading || password.length < 8}
                className="w-full gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Definir senha
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className="w-full gap-2"
                onClick={(e) => handleReset(e, true)}
              >
                Gerar senha aleatória
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}