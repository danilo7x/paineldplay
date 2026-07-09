import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Priority = "info" | "alerta" | "urgente";
type Notice = {
  id: string;
  titulo: string;
  mensagem: string;
  autor_id: string | null;
  created_at: string;
  prioridade: Priority;
  critico: boolean;
};
type Read = { notice_id: string; user_id: string; read_at: string };
type Prof = { id: string; nome: string | null; email: string | null; avatar_url: string | null; ativo: boolean };
type Attachment = {
  id: string;
  notice_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
};

const PRIORITY_META: Record<Priority, { label: string; className: string; dot: string }> = {
  info: {
    label: "Info",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
  },
  alerta: {
    label: "Alerta",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  urgente: {
    label: "Urgente",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
  },
};

export const Route = createFileRoute("/_authenticated/avisos")({
  component: AvisosPage,
});

function AvisosPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [team, setTeam] = useState<Prof[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [ackBusy, setAckBusy] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    const [nRes, rRes, tRes, aRes] = await Promise.all([
      supabase.from("notices").select("*").order("created_at", { ascending: false }),
      supabase.from("notice_reads").select("notice_id, user_id, read_at"),
      supabase.from("profiles").select("id, nome, email, avatar_url, ativo"),
      supabase.from("notice_attachments").select("*"),
    ]);
    setNotices((nRes.data ?? []) as Notice[]);
    setReads((rRes.data ?? []) as Read[]);
    setTeam((tRes.data ?? []) as Prof[]);
    setAttachments((aRes.data ?? []) as Attachment[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // Auto-marca como lido apenas avisos NÃO críticos. Críticos exigem confirmação explícita.
  useEffect(() => {
    if (loading || notices.length === 0) return;
    const mine = new Set(reads.filter((r) => r.user_id === user.id).map((r) => r.notice_id));
    const missing = notices.filter((n) => !n.critico && !mine.has(n.id));
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

  const attachmentsByNotice = useMemo(() => {
    const m = new Map<string, Attachment[]>();
    attachments.forEach((a) => {
      const arr = m.get(a.notice_id) ?? [];
      arr.push(a);
      m.set(a.notice_id, arr);
    });
    return m;
  }, [attachments]);

  const activeTeam = useMemo(() => team.filter((t) => t.ativo), [team]);

  const myReads = useMemo(
    () => new Set(reads.filter((r) => r.user_id === user.id).map((r) => r.notice_id)),
    [reads, user.id],
  );

  async function acknowledge(noticeId: string) {
    setAckBusy(noticeId);
    const { error } = await supabase
      .from("notice_reads")
      .insert({ notice_id: noticeId, user_id: user.id });
    setAckBusy(null);
    if (error) return toast.error("Não foi possível confirmar", { description: error.message });
    toast.success("Confirmação registrada");
    fetchAll();
  }

  async function downloadAttachment(a: Attachment) {
    const { data, error } = await supabase.storage
      .from("notice-attachments")
      .createSignedUrl(a.storage_path, 60);
    if (error || !data?.signedUrl) {
      return toast.error("Erro ao baixar anexo", { description: error?.message });
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

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
            const meta = PRIORITY_META[n.prioridade] ?? PRIORITY_META.info;
            const noticeAttachments = attachmentsByNotice.get(n.id) ?? [];
            const needsAck = n.critico && !myReads.has(n.id);
            return (
              <Card
                key={n.id}
                className={`rounded-2xl bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl ${
                  needsAck
                    ? "border-rose-500/50 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]"
                    : "border-border/50"
                }`}
              >
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">{n.titulo}</h2>
                        <Badge variant="outline" className={`gap-1.5 ${meta.className}`}>
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                        {n.critico && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-rose-500/40 bg-rose-500/10 text-rose-300"
                          >
                            <AlertTriangle className="size-3" /> Leitura obrigatória
                          </Badge>
                        )}
                      </div>
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

                  {noticeAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {noticeAttachments.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => downloadAttachment(a)}
                          className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs transition hover:border-primary/50 hover:text-foreground"
                        >
                          <Paperclip className="size-3.5" />
                          <span className="max-w-[220px] truncate">{a.filename}</span>
                          <Download className="size-3.5 opacity-60" />
                        </button>
                      ))}
                    </div>
                  )}

                  {needsAck && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
                      <p className="flex items-center gap-2 text-xs text-rose-100">
                        <AlertTriangle className="size-4" />
                        Este aviso exige confirmação de leitura.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => acknowledge(n.id)}
                        disabled={ackBusy === n.id}
                        className="gap-2 bg-rose-500/90 text-white hover:bg-rose-500"
                      >
                        {ackBusy === n.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        Li e entendi
                      </Button>
                    </div>
                  )}

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

                  {!isAdmin && !needsAck && myReads.has(n.id) && (
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
  const [prioridade, setPrioridade] = useState<Priority>(notice?.prioridade ?? "info");
  const [critico, setCritico] = useState<boolean>(notice?.critico ?? false);
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!notice) {
      setExisting([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("notice_attachments")
        .select("*")
        .eq("notice_id", notice.id);
      setExisting((data ?? []) as Attachment[]);
    })();
  }, [notice]);

  async function removeExisting(a: Attachment) {
    if (!confirm(`Remover "${a.filename}"?`)) return;
    const [{ error: dbErr }, { error: stErr }] = await Promise.all([
      supabase.from("notice_attachments").delete().eq("id", a.id),
      supabase.storage.from("notice-attachments").remove([a.storage_path]),
    ]);
    if (dbErr || stErr) return toast.error("Erro ao remover anexo");
    setExisting((prev) => prev.filter((x) => x.id !== a.id));
  }

  async function uploadAttachments(noticeId: string) {
    if (files.length === 0) return;
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${noticeId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("notice-attachments")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        toast.error(`Falha ao enviar ${file.name}`, { description: upErr.message });
        continue;
      }
      const { error: dbErr } = await supabase.from("notice_attachments").insert({
        notice_id: noticeId,
        storage_path: path,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      });
      if (dbErr) toast.error(`Falha ao registrar ${file.name}`, { description: dbErr.message });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let noticeId = notice?.id;
    if (notice) {
      const { error } = await supabase
        .from("notices")
        .update({ titulo, mensagem, prioridade, critico })
        .eq("id", notice.id);
      if (error) {
        setLoading(false);
        return toast.error("Erro ao salvar", { description: error.message });
      }
    } else {
      const { data, error } = await supabase
        .from("notices")
        .insert({ titulo, mensagem, autor_id: userId, prioridade, critico })
        .select("id")
        .single();
      if (error || !data) {
        setLoading(false);
        return toast.error("Erro ao salvar", { description: error?.message });
      }
      noticeId = data.id;
    }
    if (noticeId) await uploadAttachments(noticeId);
    setLoading(false);
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${PRIORITY_META[p].dot}`} />
                      {PRIORITY_META[p].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between rounded-lg border border-border/50 bg-card/40 px-3 py-2">
            <div>
              <Label htmlFor="n-critico" className="text-xs">
                Aviso crítico
              </Label>
              <p className="text-[10px] text-muted-foreground">Exige confirmação de leitura</p>
            </div>
            <Switch id="n-critico" checked={critico} onCheckedChange={setCritico} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Anexos</Label>
          {existing.length > 0 && (
            <ul className="space-y-1">
              {existing.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card/40 px-2 py-1 text-xs"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Paperclip className="size-3.5" /> {a.filename}
                  </span>
                  <button
                    type="button"
                    className="text-rose-300 hover:text-rose-200"
                    onClick={() => removeExisting(a)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="cursor-pointer"
          />
          {files.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {files.length} arquivo{files.length > 1 ? "s" : ""} para enviar
            </p>
          )}
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
