import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, UserPlus, Loader2, Copy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

type Role = "admin" | "staff";

type Member = {
  id: string;
  nome: string | null;
  email: string | null;
  cargo: string | null;
  avatar_url: string | null;
  ativo: boolean;
  role: Role | null;
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

  async function fetchMembers() {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, nome, email, cargo, avatar_url, ativo")
      .order("nome", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar equipe", { description: error.message });
      setLoading(false);
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    setMembers(
      (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })),
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  async function toggleAtivo(m: Member, ativo: boolean) {
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
  }

  async function changeRole(m: Member, role: Role) {
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

      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum colaborador ainda.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const isSelf = m.id === user.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
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
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.cargo ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={m.role === "admin" ? "default" : "secondary"}
                        className={m.role === "admin" ? "bg-primary/20 text-primary hover:bg-primary/30" : ""}
                      >
                        {m.role === "admin" ? "Admin" : m.role === "staff" ? "Colaborador" : "—"}
                      </Badge>
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
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isSelf}
                            onClick={() => toggleAtivo(m, !m.ativo)}
                          >
                            {m.ativo ? "Desativar" : "Ativar"}
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
          setInviteOpen(false);
          fetchMembers();
        }}
      />
    </div>
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
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function reset() {
    setNome("");
    setEmail("");
    setCargo("");
    setRole("staff");
    setTempPassword(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
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
        body: JSON.stringify({ nome, email, cargo: cargo || null, role }),
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
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Colaborador</SelectItem>
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