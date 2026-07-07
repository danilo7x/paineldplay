import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

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

type Notice = {
  id: string;
  titulo: string;
  mensagem: string;
  autor_id: string | null;
  created_at: string;
};
type Read = { notice_id: string; user_id: string; read_at: string };
type Prof = { id: string; nome: string | null; email: string | null; avatar_url: string | null; ativo: boolean };

export const Route = createFileRoute("/_authenticated/avisos")({
  component: AvisosPage,
});

function AvisosPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [team, setTeam] = useState<Prof[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  async function fetchAll() {
    setLoading(true);
    const [nRes, rRes, tRes] = await Promise.all([
      supabase.from("notices").select("*").order("created_at", { ascending: false }),
      supabase.from("notice_reads").select("notice_id, user_id, read_at"),
      supabase.from("profiles").select("id, nome, email, avatar_url, ativo"),
    ]);
    setNotices((nRes.data ?? []) as Notice[]);
    setReads((rRes.data ?? []) as Read[]);
    setTeam((tRes.data ?? []) as Prof[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // mark as read: any notice the current user hasn't yet
  useEffect(() => {
    if (loading || notices.length === 0) return;
    const mine = new Set(reads.filter((r) => r.user_id === user.id).map((r) => r.notice_id));
    const missing = notices.filter((n) => !mine.has(n.id));
    if (missing.length === 0) return;
    (async () => {
      const { error } = await supabase
        .from("notice_reads")
        .insert(missing.map((n) => ({ notice_id: n.id, user_id: user.id })));
      if (!error) fetchAll();
    })();
  }, [loading, notices, reads, user.id]);

  const authorMap = useMemo(() => {
    const m = new Map<string, Prof>();
    team.forEach((p) => m.set(p.id, p));
    return m;
  }, [team]);

  const readsByNotice = useMemo(() => {
    const m = new Map<string, Set<string>>();
    reads.forEach((r) => {
      const s = m.get(r.notice_id) ?? new Set<string>();
      s.add(r.user_id);
      m.set(r.notice_id, s);
    });
    return m;
  }, [reads]);

  const activeTeam = useMemo(() => team.filter((t) => t.ativo), [team]);

  async function remove(id: string) {
    if (!confirm("Excluir este aviso?")) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Aviso excluído");
    fetchAll();
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Comunicação</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Avisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Publique comunicados para toda a equipe e acompanhe leituras."
              : "Comunicados internos da DPlay Solutions."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Novo aviso
              </Button>
            </DialogTrigger>
            <NoticeDialog
              userId={user.id}
              onSaved={() => {
                setOpen(false);
                fetchAll();
              }}
            />
          </Dialog>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : notices.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/60 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Megaphone className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum aviso publicado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notices.map((n) => {
            const readSet = readsByNotice.get(n.id) ?? new Set();
            const readers = activeTeam.filter((t) => readSet.has(t.id));
            const nonReaders = activeTeam.filter((t) => !readSet.has(t.id));
            const author = n.autor_id ? authorMap.get(n.autor_id) : null;
            return (
              <Card
                key={n.id}
                className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl"
              >
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-tight">{n.titulo}</h2>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="size-5">
                          <AvatarImage src={author?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary/20 text-[9px] font-semibold text-primary">
                            {(author?.nome ?? author?.email ?? "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{author?.nome ?? author?.email ?? "—"}</span>
                        <span>·</span>
                        <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => setEditing(n)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-300 hover:text-rose-200"
                          onClick={() => remove(n.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{n.mensagem}</p>

                  {isAdmin && activeTeam.length > 0 && (
                    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs">
                        <span className="font-medium">
                          Leituras: {readers.length} de {activeTeam.length}
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round((readers.length / activeTeam.length) * 100)}%
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ReaderColumn label="Leu" people={readers} accent />
                        <ReaderColumn label="Não leu" people={nonReaders} />
                      </div>
                    </div>
                  )}

                  {!isAdmin && (
                    <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                      <CheckCircle2 className="size-3.5" /> Marcado como lido
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <NoticeDialog
            userId={user.id}
            notice={editing}
            onSaved={() => {
              setEditing(null);
              fetchAll();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function ReaderColumn({
  label,
  people,
  accent,
}: {
  label: string;
  people: Prof[];
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={`mb-2 text-[10px] uppercase tracking-widest ${
          accent ? "text-emerald-300" : "text-muted-foreground"
        }`}
      >
        {label} ({people.length})
      </p>
      {people.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <Avatar className="size-5">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-[9px] font-semibold text-primary">
                  {(p.nome ?? p.email ?? "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{p.nome ?? p.email ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoticeDialog({
  userId,
  notice,
  onSaved,
}: {
  userId: string;
  notice?: Notice;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState(notice?.titulo ?? "");
  const [mensagem, setMensagem] = useState(notice?.mensagem ?? "");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = notice
      ? await supabase.from("notices").update({ titulo, mensagem }).eq("id", notice.id)
      : await supabase.from("notices").insert({ titulo, mensagem, autor_id: userId });
    setLoading(false);
    if (res.error) return toast.error("Erro ao salvar", { description: res.error.message });
    toast.success(notice ? "Aviso atualizado" : "Aviso publicado");
    onSaved();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{notice ? "Editar aviso" : "Novo aviso"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="n-titulo">Título</Label>
          <Input
            id="n-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-msg">Mensagem</Label>
          <Textarea
            id="n-msg"
            rows={6}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {notice ? "Salvar alterações" : "Publicar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
