import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é Rani, a assistente executiva da DPlay Solutions.
Fale português do Brasil, tom próximo, direto e prestativo. Use markdown quando ajudar.
Você tem ferramentas para consultar dados reais do usuário (vendas, despesas, projetos, avisos)
e para criar notas rápidas. Sempre que a pergunta envolver números, prazos ou listas,
chame as ferramentas antes de responder. Nunca invente valores.
Ao apresentar valores monetários use R$ no formato brasileiro (ex.: R$ 12.345,67).`;

export const Route = createFileRoute("/api/rani/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice("Bearer ".length);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Supabase env missing", { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return new Response("LOVABLE_API_KEY missing", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) return new Response("messages required", { status: 400 });
        const modelMessages = await convertToModelMessages(body.messages);

        const monthRange = () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
          return { start, end };
        };

        const tools = {
          resumo_financeiro: tool({
            description:
              "Retorna receita (vendas), despesas e lucro do mês atual do usuário. Use para perguntas sobre faturamento, gastos ou lucro do mês.",
            inputSchema: z.object({}),
            execute: async () => {
              const { start, end } = monthRange();
              const [salesRes, expRes] = await Promise.all([
                supabase
                  .from("sales")
                  .select("valor, data, status")
                  .gte("data", start.slice(0, 10))
                  .lt("data", end.slice(0, 10)),
                supabase
                  .from("expenses")
                  .select("valor, data")
                  .gte("data", start.slice(0, 10))
                  .lt("data", end.slice(0, 10)),
              ]);
              const receita = (salesRes.data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
              const despesas = (expRes.data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
              return {
                mes: start.slice(0, 7),
                receita,
                despesas,
                lucro: receita - despesas,
                vendas_count: salesRes.data?.length ?? 0,
                despesas_count: expRes.data?.length ?? 0,
              };
            },
          }),
          listar_vendas: tool({
            description:
              "Lista as vendas mais recentes do usuário. Aceita filtro opcional de status (pendente, pago, cancelado) e limite (padrão 10).",
            inputSchema: z.object({
              status: z.string().nullable(),
              limit: z.number().nullable(),
            }),
            execute: async ({ status, limit }) => {
              let q = supabase
                .from("sales")
                .select("id, cliente_nome, valor, status, data, project_id")
                .order("data", { ascending: false })
                .limit(Math.min(Math.max(limit ?? 10, 1), 50));
              if (status === "pendente" || status === "pago" || status === "cancelado") {
                q = q.eq("status", status);
              }
              const { data, error } = await q;
              if (error) return { error: error.message };
              return { vendas: data ?? [] };
            },
          }),
          listar_projetos: tool({
            description: "Lista os projetos do usuário com status. Use para perguntas sobre projetos ativos, andamento, etc.",
            inputSchema: z.object({ status: z.string().nullable() }),
            execute: async ({ status }) => {
              let q = supabase.from("projects").select("id, nome, status, created_at").order("created_at", { ascending: false }).limit(50);
              if (
                status === "concluido" ||
                status === "em_desenvolvimento" ||
                status === "em_manutencao" ||
                status === "pausado"
              ) {
                q = q.eq("status", status);
              }
              const { data, error } = await q;
              if (error) return { error: error.message };
              return { projetos: data ?? [] };
            },
          }),
          listar_despesas: tool({
            description: "Lista as despesas mais recentes do usuário. Aceita categoria opcional e limite (padrão 10).",
            inputSchema: z.object({
              categoria: z.string().nullable(),
              limit: z.number().nullable(),
            }),
            execute: async ({ categoria, limit }) => {
              let q = supabase
                .from("expenses")
                .select("id, descricao, valor, categoria, data, project_id")
                .order("data", { ascending: false })
                .limit(Math.min(Math.max(limit ?? 10, 1), 50));
              if (categoria) q = q.eq("categoria", categoria);
              const { data, error } = await q;
              if (error) return { error: error.message };
              return { despesas: data ?? [] };
            },
          }),
          listar_avisos: tool({
            description: "Lista os avisos mais recentes.",
            inputSchema: z.object({ limit: z.number().nullable() }),
            execute: async ({ limit }) => {
              const { data, error } = await supabase
                .from("notices")
                .select("id, titulo, conteudo, created_at")
                .order("created_at", { ascending: false })
                .limit(Math.min(Math.max(limit ?? 5, 1), 20));
              if (error) return { error: error.message };
              return { avisos: data ?? [] };
            },
          }),
          criar_nota: tool({
            description: "Cria uma nota pessoal rápida para o usuário. Use quando ele pedir para anotar/lembrar algo.",
            inputSchema: z.object({
              titulo: z.string(),
              conteudo: z.string(),
            }),
            execute: async ({ titulo, conteudo }) => {
              const { data, error } = await supabase
                .from("notes")
                .insert({ user_id: userId, titulo, conteudo })
                .select()
                .single();
              if (error) return { error: error.message };
              return { ok: true, id: data.id };
            },
          }),
        };

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(8),
        });

        // Custom NDJSON stream: {type:"text",text} | {type:"tool-start",name} | {type:"tool-end",name,ok}
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (obj: unknown) =>
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
            try {
              for await (const part of result.fullStream) {
                if (part.type === "text-delta") {
                  send({ type: "text", text: part.text });
                } else if (part.type === "tool-call") {
                  send({ type: "tool-start", name: part.toolName });
                } else if (part.type === "tool-result") {
                  const output = (part as { output?: unknown }).output;
                  const ok = !(output && typeof output === "object" && "error" in output);
                  send({ type: "tool-end", name: part.toolName, ok });
                } else if (part.type === "error") {
                  send({ type: "error", message: String((part as { error?: unknown }).error) });
                }
              }
            } catch (err) {
              send({ type: "error", message: err instanceof Error ? err.message : "stream error" });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8" },
        });
      },
    },
  },
});