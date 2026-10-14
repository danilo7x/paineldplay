import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Envio pela Evolution API, feito pela função send-whatsapp (as chaves ficam no servidor). */
const FUNCTION = "send-whatsapp";

export type WhatsappInstanceStatus = {
  user_id: string;
  instance: string;
  connected: boolean;
};

export type WhatsappStatus = {
  configured: boolean;
  connected: boolean;
  /** Com lead: instância do responsável, que enviaria a mensagem (null = sem número). */
  instance?: string | null;
  /** Sem lead: todos os números cadastrados. */
  instances?: WhatsappInstanceStatus[];
};

/** Erro do envio; `code === "already_sent"` quando a mensagem já saiu e falta registrar. */
export class WhatsappSendError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function sendError(error: unknown): Promise<WhatsappSendError> {
  // FunctionsHttpError traz a resposta original em `context`.
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return new WhatsappSendError(String(body.error), body.code);
    } catch {
      /* resposta sem JSON */
    }
  }
  return new WhatsappSendError(
    error instanceof Error ? error.message : "Falha ao falar com o servidor.",
  );
}

/** Status do WhatsApp; com `leadId`, do número que enviaria para aquele lead. */
export function useWhatsappStatus(leadId?: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["leads", "whatsapp-status", leadId ?? "todos"],
    queryFn: async (): Promise<WhatsappStatus> => {
      const { data, error } = await supabase.functions.invoke(FUNCTION, {
        body: leadId ? { action: "status", lead_id: leadId } : { action: "status" },
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
}): Promise<{ messageId: string | null; instance: string | null }> {
  const { data, error } = await supabase.functions.invoke(FUNCTION, {
    body: {
      action: "send",
      lead_id: input.leadId,
      activity_id: input.activityId,
      text: input.text,
    },
  });
  if (error) throw await sendError(error);
  if (!data?.ok) throw new Error(data?.error ?? "A mensagem não foi enviada.");
  return { messageId: data.messageId ?? null, instance: data.instance ?? null };
}

/* ------------------------------------------------------------------ */
/* Conexão dos números (Equipe → Conectar WhatsApp), só para admin     */
/* ------------------------------------------------------------------ */

export type ConnectionState = "open" | "connecting" | "close" | "missing";

export type ConnectResult = {
  instance: string | null;
  state: ConnectionState;
  qr?: string | null;
  pairingCode?: string | null;
};

async function adminCall(body: Record<string, unknown>): Promise<ConnectResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION, { body });
  if (error) throw await sendError(error);
  if (data?.error) throw new WhatsappSendError(String(data.error));
  return data as ConnectResult;
}

export const whatsappAdmin = {
  status: (userId: string) => adminCall({ action: "admin_status", user_id: userId }),
  connect: (userId: string, instance: string, number?: string) =>
    adminCall({ action: "admin_connect", user_id: userId, instance, number: number || undefined }),
  logout: (userId: string) => adminCall({ action: "admin_logout", user_id: userId }),
};
