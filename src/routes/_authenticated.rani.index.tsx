import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/lib/profile-context";
import {
  emitRaniThreadsChanged,
  RANI_PLACEHOLDER_REPLY,
  RANI_SUGGESTIONS,
} from "@/features/rani/store";
import { RaniMark } from "./_authenticated.rani";

export const Route = createFileRoute("/_authenticated/rani/")({
  ssr: false,
  component: RaniHome,
});

function RaniHome() {
  const navigate = useNavigate();
  const { firstName } = useProfile();
  const [creating, setCreating] = useState(false);

  async function startWith(message: string) {
    const text = message.trim();
    if (!text || creating) return;
    setCreating(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      setCreating(false);
      return;
    }
    const title = text.length > 60 ? text.slice(0, 57) + "…" : text;
    const { data: thread, error } = await supabase
      .from("rani_threads")
      .insert({ user_id: uid, title })
      .select()
      .single();
    if (error || !thread) {
      setCreating(false);
      return toast.error("Não foi possível iniciar", { description: error?.message });
    }
    const msgErr = (
      await supabase.from("rani_messages").insert([
        { thread_id: thread.id, user_id: uid, role: "user", content: text },
        {
          thread_id: thread.id,
          user_id: uid,
          role: "assistant",
          content: RANI_PLACEHOLDER_REPLY,
        },
      ])
    ).error;
    if (msgErr) toast.error("Falha ao salvar mensagem", { description: msgErr.message });
    emitRaniThreadsChanged();
    setCreating(false);
    navigate({ to: "/rani/$threadId", params: { threadId: thread.id } });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <RaniMark size={72} />
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Olá, <span className="capitalize">{firstName}</span> 👋
            </h1>
            <Badge
              variant="secondary"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            >
              Ativa
            </Badge>
          </div>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Sou a Rani, sua assistente da DPlay. Pergunte sobre projetos, vendas, despesas ou
            avisos — respondo com dados reais do seu CRM.
          </p>
        </div>

        <ul className="mx-auto grid w-full max-w-2xl gap-2 sm:grid-cols-2">
          {RANI_SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                onClick={() => startWith(s)}
                disabled={creating}
                className="w-full rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-card hover:text-foreground disabled:opacity-60"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-3xl pb-2">
        <PromptInputBox
          onSend={(msg) => startWith(msg)}
          isLoading={creating}
          placeholder="Escreva para começar uma nova conversa…"
        />
      </div>
    </div>
  );
}