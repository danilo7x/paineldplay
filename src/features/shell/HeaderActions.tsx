import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, LogOut, Settings, UserRound } from "lucide-react";
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

type NoticeItem = { id: string; titulo: string; created_at: string };

export function HeaderActions() {
  const { user, isAdmin } = AuthRoute.useRouteContext();
  const { profile, firstName, initials } = useProfile();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [nRes, rRes] = await Promise.all([
        supabase
          .from("notices")
          .select("id, titulo, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("notice_reads")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", user.id),
      ]);
      if (!alive) return;
      const list = (nRes.data ?? []) as NoticeItem[];
      setNotices(list);
      setUnread(Math.max(0, list.length - (rRes.count ?? 0)));
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="ml-auto flex items-center gap-1">
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
            {unread > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                {unread} nova{unread > 1 ? "s" : ""}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notices.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Sem notificações no momento.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {notices.slice(0, 6).map((n) => (
                <Link
                  key={n.id}
                  to="/avisos"
                  className="block px-3 py-2 text-sm transition hover:bg-accent/60"
                >
                  <p className="line-clamp-1 font-medium">{n.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </Link>
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