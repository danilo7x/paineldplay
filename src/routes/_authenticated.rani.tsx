import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { Route as AuthRoute } from "@/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/rani")({
  ssr: false,
  component: RaniPage,
});

type Msg = { id: string; role: "user" | "assistant"; content: string; at: number };

// TODO (ativação futura da Rani):
// - Substituir sendToRani por chamada real ao modelo (ex.: Lovable AI Gateway).
// - Passar como contexto: usuário logado, papel (admin/staff), e prompt de sistema
//   especializado em Tecnologia da Informação / software house.
// - CRÍTICO — RESPEITAR RLS: as consultas aos dados (projects, sales, expenses,
//   activity_logs, profiles, project_members) devem ser feitas com o token do
//   usuário logado (client supabase padrão, RLS ativo) OU via server function
//   com requireSupabaseAuth. NUNCA usar service role para responder ao staff.
//   Admin recebe visão global; staff só o que participa.
// - Habilidades: somatórios, margens (receita − despesa), comparações entre
//   períodos, progresso de projeto, listagem de vendas/despesas.
async function sendToRani(_message: string, _context?: unknown): Promise<string> {
  await new Promise((r) => setTimeout(r, 500));
  return "Oi! Eu sou a Rani. Ainda estou sendo ativada e em breve vou poder consultar seus dados e responder de verdade. Por enquanto, você já pode conversar comigo por aqui — quando eu ligar, seu histórico e permissões vão junto.";
}

function RaniPage() {
  const { user } = AuthRoute.useRouteContext();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(message: string, _files?: File[]) {
    const text = message.trim();
    if (!text) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, at: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const reply = await sendToRani(text, { userId: user.id });
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: reply, at: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#057EF3] to-[#0157C6] text-white shadow-lg shadow-[#057EF3]/30">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Rani</h1>
              <Badge variant="secondary" className="rounded-full border border-[#057EF3]/30 bg-[#057EF3]/10 text-[#057EF3]">
                Em breve
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua assistente da DPlay — em breve, com acesso aos seus projetos, faturamento e atividade.
            </p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-xl"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-[#057EF3]/30 to-[#0157C6]/20 text-[#057EF3]">
              <Sparkles className="size-7" />
            </div>
            <div>
              <p className="text-sm font-medium">Olá, {user.email?.split("@")[0] ?? "por aqui"} 👋</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Assim que eu for ativada, vou poder responder coisas como "quanto faturei esse mês?",
                "quais os gastos do projeto X?" ou "como está o progresso das etapas".
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "assistant" && (
                  <div className="mr-2 mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#057EF3] to-[#0157C6] text-white">
                    <Sparkles className="size-3.5" />
                  </div>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-[#057EF3] px-4 py-2.5 text-sm text-white shadow-sm"
                      : "max-w-[80%] rounded-2xl rounded-bl-md border border-border/40 bg-background/60 px-4 py-2.5 text-sm text-foreground"
                  }
                >
                  {m.content}
                </div>
              </li>
            ))}
            {loading && (
              <li className="flex justify-start">
                <div className="mr-2 mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#057EF3] to-[#0157C6] text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-border/40 bg-background/60 px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-[#057EF3] [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#057EF3] [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#057EF3]" />
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="mx-auto w-full max-w-3xl">
        <PromptInputBox
          onSend={handleSend}
          isLoading={loading}
          placeholder="Converse com a Rani…"
        />
      </div>
    </div>
  );
}