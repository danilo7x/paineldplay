import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Paperclip, Search, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  emitRaniThreadsChanged,
  type RaniAttachment,
  type RaniMessage,
  type RaniThread,
} from "@/features/rani/store";
import { RaniMark } from "./_authenticated.rani";

type ToolStatus = "running" | "done" | "error";
type ToolEvent = { name: string; status: ToolStatus };
type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool-start"; name: string }
  | { type: "tool-end"; name: string; ok: boolean }
  | { type: "error"; message: string };

const TOOL_LABELS: Record<string, string> = {
  resumo_financeiro: "Calculando resumo financeiro",
  listar_vendas: "Buscando vendas",
  listar_despesas: "Buscando despesas",
  listar_projetos: "Buscando projetos",
  listar_avisos: "Buscando avisos",
  criar_nota: "Salvando nota",
};

export const Route = createFileRoute("/_authenticated/rani/$threadId")({
  ssr: false,
  component: RaniThreadPage,
});

function RaniThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState<RaniThread | null>(null);
  const [messages, setMessages] = useState<RaniMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [toolActivity, setToolActivity] = useState<Record<string, ToolEvent[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, mRes] = await Promise.all([
      supabase.from("rani_threads").select("*").eq("id", threadId).maybeSingle(),
      supabase
        .from("rani_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
    ]);
    if (!tRes.data) {
      toast.error("Conversa não encontrada");
      navigate({ to: "/rani" });
      return;
    }
    setThread(tRes.data as RaniThread);
    setMessages(((mRes.data ?? []) as unknown[]).map(normalizeMessage));
    setLoading(false);
  }, [threadId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  async function uploadAttachments(files: File[], uid: string): Promise<RaniAttachment[]> {
    const out: RaniAttachment[] = [];
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`"${f.name}" excede 20 MB e foi ignorado`);
        continue;
      }
      const safe = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${threadId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("rani-attachments")
        .upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (error) {
        toast.error(`Falha no upload de ${f.name}`, { description: error.message });
        continue;
      }
      out.push({ name: f.name, path, size: f.size, mime: f.type || null });
    }
    return out;
  }

  async function handleSend(message: string, files?: File[]) {
    const text = message.trim();
    if (!text && !(files && files.length)) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const accessToken = sess.session?.access_token;
    if (!uid || !accessToken) return;

    setTyping(true);

    const attachments = files && files.length ? await uploadAttachments(files, uid) : [];

    const userInsert = await supabase
      .from("rani_messages")
      .insert({
        thread_id: threadId,
        user_id: uid,
        role: "user",
        content: text,
        attachments: attachments as unknown as never,
      })
      .select()
      .single();

    if (userInsert.error || !userInsert.data) {
      setTyping(false);
      return toast.error("Não foi possível enviar", {
        description: userInsert.error?.message,
      });
    }

    setMessages((prev) => [...prev, normalizeMessage(userInsert.data)]);

    // Rename thread from first user message if still default
    if (thread && thread.title === "Nova conversa" && text) {
      const newTitle = text.length > 60 ? text.slice(0, 57) + "…" : text;
      const { data: updated } = await supabase
        .from("rani_threads")
        .update({ title: newTitle })
        .eq("id", threadId)
        .select()
        .single();
      if (updated) setThread(updated as RaniThread);
      emitRaniThreadsChanged();
    } else {
      // touch updated_at so sidebar sorts fresh
      await supabase.from("rani_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
      emitRaniThreadsChanged();
    }

    // Stream real response from Rani
    const streamingId = `streaming-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: streamingId,
        thread_id: threadId,
        user_id: uid,
        role: "assistant",
        content: "",
        attachments: [],
        created_at: new Date().toISOString(),
      },
    ]);
    setToolActivity((prev) => ({ ...prev, [streamingId]: [] }));

    let fullText = "";
    try {
      const history = [
        ...messages,
        normalizeMessage(userInsert.data),
      ].map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));

      const resp = await fetch("/api/rani/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!resp.ok || !resp.body) {
        const msg = await resp.text().catch(() => "");
        throw new Error(msg || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: StreamEvent | null = null;
          try {
            evt = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (evt.type === "text") {
            fullText += evt.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === streamingId ? { ...m, content: fullText } : m)),
            );
          } else if (evt.type === "tool-start") {
            setToolActivity((prev) => ({
              ...prev,
              [streamingId]: [
                ...(prev[streamingId] ?? []),
                { name: evt.name, status: "running" },
              ],
            }));
          } else if (evt.type === "tool-end") {
            setToolActivity((prev) => {
              const list = [...(prev[streamingId] ?? [])];
              // mark the most recent running entry with this name as done
              for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].name === evt.name && list[i].status === "running") {
                  list[i] = { name: evt.name, status: evt.ok ? "done" : "error" };
                  break;
                }
              }
              return { ...prev, [streamingId]: list };
            });
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }

      if (!fullText.trim()) fullText = "…";

      const assistantInsert = await supabase
        .from("rani_messages")
        .insert({
          thread_id: threadId,
          user_id: uid,
          role: "assistant",
          content: fullText,
        })
        .select()
        .single();
      if (assistantInsert.data) {
        const normalized = normalizeMessage(assistantInsert.data);
        setMessages((prev) => prev.map((m) => (m.id === streamingId ? normalized : m)));
        setToolActivity((prev) => {
          const list = prev[streamingId];
          if (!list) return prev;
          const next = { ...prev };
          delete next[streamingId];
          if (list.length) next[normalized.id] = list;
          return next;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Rani falhou ao responder", { description: message });
      setMessages((prev) => prev.filter((m) => m.id !== streamingId));
      setToolActivity((prev) => {
        const next = { ...prev };
        delete next[streamingId];
        return next;
      });
    } finally {
      setTyping(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/40 px-4 py-3 backdrop-blur-xl">
        <RaniMark size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">
              {thread?.title ?? "Conversa"}
            </h1>
            <Badge
              variant="secondary"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400"
            >
              Ativa
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Conectada aos seus dados: vendas, despesas, projetos e avisos.
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-xl"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Envie a primeira mensagem…
          </div>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => (
              <MessageRow key={m.id} m={m} tools={toolActivity[m.id]} />
            ))}
            {typing && <TypingIndicator />}
          </ul>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <PromptInputBox
          onSend={handleSend}
          isLoading={typing}
          placeholder="Escreva para a Rani…"
        />
      </div>
    </div>
  );
}

function MessageRow({ m, tools }: { m: RaniMessage; tools?: ToolEvent[] }) {
  const isUser = m.role === "user";
  return (
    <li className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <RaniMark size={28} />}
      <div className={cn("min-w-0", isUser ? "max-w-[80%]" : "max-w-[85%] flex-1")}>
        {!isUser && tools && tools.length > 0 && <ToolActivity tools={tools} />}
        {isUser ? (
          <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
            {m.content}
          </div>
        ) : m.content ? (
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_p]:my-1 [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
          </div>
        ) : null}
        {m.attachments.length > 0 && <AttachmentsBar items={m.attachments} align={isUser ? "end" : "start"} />}
      </div>
    </li>
  );
}

function ToolActivity({ tools }: { tools: ToolEvent[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {tools.map((t, i) => {
        const label = TOOL_LABELS[t.name] ?? `Executando ${t.name}`;
        const Icon =
          t.status === "running" ? Loader2 : t.status === "error" ? XCircle : CheckCircle2;
        return (
          <span
            key={`${t.name}-${i}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
              t.status === "running" &&
                "border-[#057EF3]/30 bg-[#057EF3]/10 text-[#057EF3]",
              t.status === "done" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
              t.status === "error" &&
                "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            <Icon className={cn("size-3", t.status === "running" && "animate-spin")} />
            {label}
            {t.status === "running" && "…"}
          </span>
        );
      })}
    </div>
  );
}

function AttachmentsBar({
  items,
  align,
}: {
  items: RaniAttachment[];
  align: "start" | "end";
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        items.map(async (a) => {
          const { data } = await supabase.storage
            .from("rani-attachments")
            .createSignedUrl(a.path, 60 * 10);
          return [a.path, data?.signedUrl ?? ""] as const;
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap gap-1.5",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {items.map((a) => (
        <a
          key={a.path}
          href={urls[a.path] || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Paperclip className="size-3 shrink-0" />
          <span className="truncate">{a.name}</span>
        </a>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <li className="flex items-center gap-3">
      <RaniMark size={28} />
      <div className="rounded-2xl rounded-bl-md border border-border/40 bg-background/60 px-4 py-2.5">
        <span className="inline-flex gap-1">
          <span
            className="size-1.5 animate-bounce rounded-full bg-[#057EF3]"
            style={{ animationDelay: "-0.3s" }}
          />
          <span
            className="size-1.5 animate-bounce rounded-full bg-[#057EF3]"
            style={{ animationDelay: "-0.15s" }}
          />
          <span className="size-1.5 animate-bounce rounded-full bg-[#057EF3]" />
        </span>
      </div>
    </li>
  );
}

function normalizeMessage(row: unknown): RaniMessage {
  const r = row as {
    id: string;
    thread_id: string;
    user_id: string;
    role: string;
    content: string;
    attachments: unknown;
    created_at: string;
  };
  const attachments = Array.isArray(r.attachments) ? (r.attachments as RaniAttachment[]) : [];
  return {
    id: r.id,
    thread_id: r.thread_id,
    user_id: r.user_id,
    role: r.role === "assistant" ? "assistant" : "user",
    content: r.content ?? "",
    attachments,
    created_at: r.created_at,
  };
}
