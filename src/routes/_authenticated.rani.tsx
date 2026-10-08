import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import logo from "@/assets/dplay-logo-transparent.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  emitRaniThreadsChanged,
  subscribeRaniThreads,
  type RaniThread,
} from "@/features/rani/store";

export const Route = createFileRoute("/_authenticated/rani")({
  ssr: false,
  component: RaniLayout,
});

function RaniLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const [threads, setThreads] = useState<RaniThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<RaniThread | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<RaniThread | null>(null);

  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from("rani_threads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Erro ao carregar conversas", { description: error.message });
    setThreads((data ?? []) as RaniThread[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadThreads();
    const unsub = subscribeRaniThreads(loadThreads);
    return () => {
      unsub();
    };
  }, [loadThreads]);

  async function createThread() {
    if (creating) return;
    setCreating(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return setCreating(false);
    const { data, error } = await supabase
      .from("rani_threads")
      .insert({ user_id: uid, title: "Nova conversa" })
      .select()
      .single();
    setCreating(false);
    if (error || !data) return toast.error("Não foi possível criar", { description: error?.message });
    emitRaniThreadsChanged();
    navigate({ to: "/rani/$threadId", params: { threadId: data.id }, search: { send: undefined } });
  }

  async function saveRename() {
    if (!renaming) return;
    const title = renameValue.trim() || "Nova conversa";
    const { error } = await supabase
      .from("rani_threads")
      .update({ title })
      .eq("id", renaming.id);
    if (error) return toast.error("Não foi possível renomear", { description: error.message });
    setRenaming(null);
    emitRaniThreadsChanged();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const { error } = await supabase.from("rani_threads").delete().eq("id", id);
    if (error) return toast.error("Não foi possível excluir", { description: error.message });
    setDeleting(null);
    if (activeId === id) navigate({ to: "/rani" });
    emitRaniThreadsChanged();
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="hidden flex-col overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <RaniMark size={22} />
            <span className="text-sm font-semibold tracking-tight">Rani</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={createThread}
            disabled={creating}
          >
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Nova
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma conversa ainda.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {threads.map((t) => (
                <li key={t.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-lg pr-1 transition",
                      activeId === t.id
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Link
                      to="/rani/$threadId"
                      params={{ threadId: t.id }}
                      search={{ send: undefined }}
                      className="flex-1 truncate rounded-lg px-3 py-2 text-sm"
                    >
                      {t.title || "Nova conversa"}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded-md p-1 opacity-0 transition hover:bg-muted group-hover:opacity-100 data-[state=open]:opacity-100"
                          aria-label="Ações"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameValue(t.title);
                            setRenaming(t);
                          }}
                        >
                          <Pencil className="mr-2 size-4" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleting(t)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/40 px-4 py-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3" /> Rani ativa • conectada aos seus dados
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0">
        <Outlet />
      </div>

      {/* Rename dialog */}
      <AlertDialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renomear conversa</AlertDialogTitle>
            <AlertDialogDescription>Escolha um título mais fácil de lembrar.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Título da conversa"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={saveRename}>Salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens de <strong>{deleting?.title}</strong> serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Rani identity mark — DPlay logo with a soft pulse ring
export function RaniMark({ size = 44 }: { size?: number }) {
  const px = `${size}px`;
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: px, height: px }}
    >
      <span
        className="absolute inset-0 animate-ping rounded-full bg-[#057EF3]/30"
        style={{ animationDuration: "2.4s" }}
      />
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#057EF3]/25 to-[#0157C6]/10 blur-md" />
      <span
        className="relative grid place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#057EF3] to-[#0157C6] shadow-lg shadow-[#057EF3]/30 ring-1 ring-white/10"
        style={{ width: px, height: px }}
      >
        <img
          src={logo.url}
          alt="Rani"
          className="object-contain"
          style={{ width: size * 0.62, height: size * 0.62 }}
        />
      </span>
    </span>
  );
}