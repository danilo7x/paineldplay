import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Envio pela Evolution API, feito pela função send-whatsapp (as chaves ficam no servidor). */
const FUNCTION = "send-whatsapp";

export type WhatsappStatus = { configured: boolean; connected: boolean };

async function errorMessage(error: unknown): Promise<string> {
  // FunctionsHttpError traz a resposta original em `context`.
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* resposta sem JSON */
    }
  }
  return error instanceof Error ? error.message : "Falha ao falar com o servidor.";
}

export function useWhatsappStatus() {
  return useQuery({
    queryKey: ["leads", "whatsapp-status"],
    queryFn: async (): Promise<WhatsappStatus> => {
      const { data, error } = await supabase.functions.invoke(FUNCTION, {
        body: { action: "status" },
      });
      // Função ainda não publicada ou sem acesso: trata como não configurado.
      if (error) return { configured: false, connected: false };
      return data as WhatsappStatus;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export async function sendWhatsapp(input: {
  leadId: string;
  activityId: string;
  text: string;
}): Promise<{ messageId: string | null }> {
  const { data, error } = await supabase.functions.invoke(FUNCTION, {
    body: {
      action: "send",
      lead_id: input.leadId,
      activity_id: input.activityId,
      text: input.text,
    },
  });
  if (error) throw new Error(await errorMessage(error));
  if (!data?.ok) throw new Error(data?.error ?? "A mensagem não foi enviada.");
  return { messageId: data.messageId ?? null };
}
