import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

type PF = {
  id: string;
  owner_id: string;
  titulo: string;
  descricao: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
};
type Owner = { id: string; nome: string | null; email: string | null; avatar_url: string | null };
type OwnerWithRole = Owner & { is_admin: boolean };

export const Route = createFileRoute("/_authenticated/arquivos")({
  component: ArquivosPage,
});

const fmtSize = (n: number | null) => {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

function ArquivosPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const [files, setFiles] = useState<PF[]>([]);
  const [owners, setOwners] = useState<Map<string, OwnerWithRole>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("personal_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar", { description: error.message });
    const list = (rows ?? []) as PF[];
    setFiles(list);
    if (isAdmin) {
      const ids = Array.from(new Set(list.map((f) => f.owner_id)));
      if (ids.length) {
        const [profRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("id, nome, email, avatar_url").in("id", ids),
          supabase.from("user_roles").select("user_id, role").in("user_id", ids),
        ]);
        const adminSet = new Set(
          (rolesRes.data ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
        );
        const map = new Map<string, OwnerWithRole>();
        (profRes.data ?? []).forEach((p: any) =>
          map.set(p.id, { ...(p as Owner), is_admin: adminSet.has(p.id) }),
        );
        setOwners(map);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function download(f: PF) {
    const { data, error } = await supabase.storage
      .from("personal-files")
      .createSignedUrl(f.file_path, 60);
    if (error || !data) return toast.error("Não foi possível baixar");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = f.file_name;
    a.click();
  }

  async function remove(f: PF) {
    if (!confirm(`Excluir "${f.titulo}"?`)) return;
    await supabase.storage.from("personal-files").remove([f.file_path]);
    const { error } = await supabase.from("personal_files").delete().eq("id", f.id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Arquivo removido");
    fetchAll();
  }

  const cofre = useMemo(
    () => files.filter((f) => owners.get(f.owner_id)?.is_admin),
    [files, owners],
  );
  const equipe = useMemo(() => {
    const grouped = new Map<string, PF[]>();
    files
      .filter((f) => !owners.get(f.owner_id)?.is_admin)
      .forEach((f) => {
        const arr = grouped.get(f.owner_id) ?? [];
        arr.push(f);
        grouped.set(f.owner_id, arr);
      });
    return grouped;
  }, [files, owners]);
  const meus = useMemo(() => files.filter((f) => f.owner_id === user.id), [files, user.id]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pessoal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Meus arquivos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Cofre dos sócios e arquivos pessoais de cada colaborador."
              : "Espaço privado só seu, criptografado no bucket da equipe."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="size-4" /> Novo arquivo
            </Button>
          </DialogTrigger>
          <UploadDialog
            userId={user.id}
            onDone={() => {
              setOpen(false);
              fetchAll();
            }}
          />
        </Dialog>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isAdmin ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Cofre dos sócios
            </h2>
            <FileGrid files={cofre} onDownload={download} onDelete={remove} />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Arquivos da equipe
            </h2>
            {equipe.size === 0 ? (
              <EmptyState text="Nenhum arquivo da equipe." />
            ) : (
              <div className="space-y-6">
                {Array.from(equipe.entries()).map(([ownerId, list]) => {
                  const o = owners.get(ownerId);
                  return (
                    <div key={ownerId} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage src={o?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                            {(o?.nome ?? o?.email ?? "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-sm">
                          <span className="font-medium">{o?.nome ?? o?.email ?? "—"}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {list.length} arquivo{list.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <FileGrid files={list} onDownload={download} onDelete={remove} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <FileGrid files={meus} onDownload={download} onDelete={remove} />
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="rounded-2xl border-dashed border-border/60 bg-card/40">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function FileGrid({
  files,
  onDownload,
  onDelete,
}: {
  files: PF[];
  onDownload: (f: PF) => void;
  onDelete: (f: PF) => void;
}) {
  if (files.length === 0) return <EmptyState text="Nenhum arquivo aqui ainda." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {files.map((f) => (
        <Card
          key={f.id}
          className="rounded-2xl border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl"
        >
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">{f.file_name}</p>
              {f.descricao && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.descricao}</p>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {fmtSize(f.size)} · {new Date(f.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onDownload(f)}>
                <Download className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-rose-300 hover:text-rose-200"
                onClick={() => onDelete(f)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UploadDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);

  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
  const ALLOWED = [
    "image/",
    "video/",
    "audio/",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/",
  ];

  function validateFile(f: File): string | null {
    if (f.size > MAX_SIZE) {
      return `Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). Limite: 50 MB.`;
    }
    const type = f.type || "";
    const ok = type && ALLOWED.some((p) => (p.endsWith("/") ? type.startsWith(p) : type === p));
    if (!ok) {
      return "Tipo de arquivo não permitido. Envie imagens, vídeos, áudios, PDFs, ZIP/RAR ou documentos Office.";
    }
    return null;
  }

  function pickFile(f: File | null) {
    setFile(f);
    setProgress(0);
    if (!f) {
      setFileError(null);
      return;
    }
    const err = validateFile(f);
    setFileError(err);
    if (!titulo) setTitulo(f.name.replace(/\.[^/.]+$/, ""));
  }

  function uploadWithProgress(url: string, token: string, f: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-upsert", "false");
      if (f.type) xhr.setRequestHeader("Content-Type", f.type);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Falha no upload (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Falha de rede durante o upload"));
      xhr.onabort = () => reject(new Error("Upload cancelado"));
      xhr.send(f);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Selecione um arquivo");
    const err = validateFile(file);
    if (err) {
      setFileError(err);
      return toast.error(err);
    }
    setLoading(true);
    setProgress(0);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const signed = await supabase.storage.from("personal-files").createSignedUploadUrl(path);
    if (signed.error || !signed.data) {
      setLoading(false);
      return toast.error("Não foi possível iniciar o upload", {
        description: signed.error?.message,
      });
    }
    try {
      await uploadWithProgress(signed.data.signedUrl, signed.data.token, file);
    } catch (e) {
      setLoading(false);
      return toast.error("Falha no upload", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
    const { error } = await supabase.from("personal_files").insert({
      owner_id: userId,
      titulo,
      descricao: descricao || null,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size: file.size,
    });
    setLoading(false);
    if (error) {
      await supabase.storage.from("personal-files").remove([path]);
      return toast.error("Não foi possível registrar", { description: error.message });
    }
    toast.success("Arquivo enviado");
    onDone();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Enviar arquivo</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="f-titulo">Título</Label>
          <Input
            id="f-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-desc">Descrição</Label>
          <Textarea
            id="f-desc"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-file">Arquivo</Label>
          <Input
            id="f-file"
            type="file"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            required
          />
          {file && !fileError && (
            <p className="text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
          {fileError && <p className="text-xs text-rose-400">{fileError}</p>}
          <p className="text-[10px] text-muted-foreground">
            Até 50 MB. Imagens, vídeos, áudios, PDFs, ZIP/RAR ou Office.
          </p>
        </div>
        {loading && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-[10px] text-muted-foreground">Enviando… {progress}%</p>
          </div>
        )}
        <DialogFooter>
          <Button type="submit" disabled={loading || !!fileError} className="w-full gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
