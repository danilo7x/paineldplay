import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  LogIn,
  LogOut,
  Megaphone,
  Settings,
  ShoppingCart,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "@/routes/_authenticated";
import { useProfile } from "@/lib/profile-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  tipo: string;
  titulo: string;
  link: string | null;
  lida_em: string | null;
  created_at: string;
};

function iconFor(tipo: string) {
  switch (tipo) {
    case "aviso_critico":
      return <AlertTriangle className="size-3.5 text-rose-300" />;
    case "aviso":
      return <Megaphone className="size-3.5 text-sky-300" />;
    case "novo_login":
      return <LogIn className="size-3.5 text-amber-300" />;
    case "projeto_membro":
      return <UserPlus className="size-3.5 text-emerald-300" />;
    case "venda":
      return <ShoppingCart className="size-3.5 text-primary" />;
    default:
      return <Bell className="size-3.5 text-muted-foreground" />;
  }
}

export function HeaderActions() {
  const { user, isAdmin } = AuthRoute.useRouteContext();
  const { profile, firstName, initials } = useProfile();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("id, tipo, titulo, link, lida_em, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!alive) return;
      setItems((data ?? []) as NotificationItem[]);
    }
    void load();
    const t = setInterval(load, 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [user.id]);

  const unread = items.filter((i) => !i.lida_em).length;

  async function markAllRead() {
    const ids = items.filter((i) => !i.lida_em).map((i) => i.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, lida_em: now } : i)));
    await supabase.from("notifications").update({ lida_em: now }).in("id", ids);
  }

  async function handleClick(n: NotificationItem) {
    if (!n.lida_em) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, lida_em: now } : i)));
      await supabase.from("notifications").update({ lida_em: now }).eq("id", n.id);
    }
    if (n.link) navigate({ to: n.link });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
      {/* Botão de busca (mobile) */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("dplay:open-search"))}
        className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Buscar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </button>
      {/* Sino de notificações */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="relative grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Notificações"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground ring-2 ring-background">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificações</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary transition hover:bg-primary/25"
              >
                <CheckCheck className="size-3" /> Marcar todas
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground">Tudo em dia</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              <Bell className="mx-auto mb-2 size-5 opacity-40" />
              Nada por aqui ainda.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-accent/60 ${
                    n.lida_em ? "opacity-70" : "bg-primary/5"
                  }`}
                >
                  <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-card/60">
                    {iconFor(n.tipo)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {!n.lida_em && (
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                      )}
                      <span className="line-clamp-2 font-medium">{n.titulo}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/avisos" className="cursor-pointer text-xs">
              Ver todos os avisos
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Engrenagem → Perfil */}
      <Link
        to="/perfil"
        className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label="Configurações"
        title="Configurações da conta"
      >
        <Settings className="size-4" />
      </Link>

      {/* Avatar + menu do usuário */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Menu do usuário"
          >
            <Avatar className="size-8 border border-border/60">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/20 text-[11px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate text-sm font-medium">{firstName}</p>
            <p className="truncate text-[11px] font-normal text-muted-foreground">
              {profile?.email ?? user.email}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {isAdmin ? "Administrador" : "Colaborador"}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/perfil" className="cursor-pointer">
              <UserRound className="mr-2 size-4" /> Meu perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/perfil" className="cursor-pointer">
              <Settings className="mr-2 size-4" /> Configurações
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 size-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}