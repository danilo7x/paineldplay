import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Loader2, Paperclip } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  emitRaniThreadsChanged,
  RANI_PLACEHOLDER_REPLY,
  type RaniAttachment,
  type RaniMessage,
  type RaniThread,
} from "@/features/rani/store";
import { RaniMark } from "./_authenticated.rani";

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
    if (!uid) return;

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

    // Placeholder reply — Rani ainda não está ativa
    await new Promise((r) => setTimeout(r, 650));

    const assistantInsert = await supabase
      .from("rani_messages")
      .insert({
        thread_id: threadId,
        user_id: uid,
        role: "assistant",
        content: RANI_PLACEHOLDER_REPLY,
      })
      .select()
      .single();

    setTyping(false);
    if (assistantInsert.data) {
      setMessages((prev) => [...prev, normalizeMessage(assistantInsert.data)]);
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
              className="rounded-full border border-[#057EF3]/30 bg-[#057EF3]/10 text-[10px] text-[#057EF3]"
            >
              Em breve
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Rani ainda não está ativa — suas mensagens ficam salvas para quando ela ligar.
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
              <MessageRow key={m.id} m={m} />
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

function MessageRow({ m }: { m: RaniMessage }) {
  const isUser = m.role === "user";
  return (
    <li className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <RaniMark size={28} />}
      <div className={cn("min-w-0", isUser ? "max-w-[80%]" : "max-w-[85%] flex-1")}>
        {isUser ? (
          <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
            {m.content}
          </div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_p]:my-1 [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
          </div>
        )}
        {m.attachments.length > 0 && <AttachmentsBar items={m.attachments} align={isUser ? "end" : "start"} />}
      </div>
    </li>
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
