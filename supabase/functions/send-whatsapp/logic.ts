// Regras do envio pela Evolution API, sem dependências do Deno (testáveis em Node).

/** URL e chave são globais; cada pessoa tem a sua instância (número). */
export type EvolutionConfig = { url: string; apiKey: string; defaultInstance: string | null };

export type LeadForSend = {
  id: string;
  responsavel_id?: string | null;
  telefone: string | null;
  nao_contatar: boolean;
  cadencia_status: string | null;
};

export type ActivityForSend = {
  id: string;
  lead_id: string;
  tipo: string;
  status: string;
  chave: string | null;
  canal?: string | null;
};

/** Canal gravado na mensagem prevista quando ela sai pela API (também serve de trava). */
export const API_CHANNEL = "whatsapp_api";

export const ALREADY_SENT_MESSAGE =
  "Esta mensagem já foi enviada pelo WhatsApp e falta registrar o envio. Clique em “Registrar envio” — não envie de novo.";

const CADENCE_KEYS = ["template_1", "template_2", "template_3", "template_4", "break_up"];

export function readConfig(get: (k: string) => string | undefined): EvolutionConfig | null {
  const url = get("EVOLUTION_API_URL")?.trim().replace(/\/+$/, "");
  const apiKey = get("EVOLUTION_API_KEY")?.trim();
  if (!url || !apiKey) return null;
  return { url, apiKey, defaultInstance: get("EVOLUTION_INSTANCE")?.trim() || null };
}

/** Instância do responsável pelo lead; sem ela, a padrão (se houver). */
export function pickInstance(
  ownerInstance: string | null | undefined,
  defaultInstance: string | null,
): string | null {
  return ownerInstance?.trim() || defaultInstance || null;
}

export const NO_INSTANCE_MESSAGE =
  "O responsável por este lead não tem WhatsApp conectado. Cadastre o número dele em Equipe.";

/** Só dígitos; números brasileiros (10 ou 11 dígitos) recebem o DDI 55. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}

export function unfilledPlaceholders(text: string): string[] {
  const found: string[] = [...(text.match(/\[[^\]]+\]/g) ?? [])];
  if (/\bLEAD\b/.test(text)) found.push("LEAD");
  return Array.from(new Set(found));
}

/** Devolve a mensagem de erro, ou null se o envio pode seguir. */
export function validateSend(
  lead: LeadForSend | null,
  activity: ActivityForSend | null,
  text: string,
): string | null {
  if (!lead) return "Lead não encontrado ou sem permissão.";
  if (lead.nao_contatar) return "Este lead pediu para não receber novos contatos.";
  if (!normalizePhone(lead.telefone)) return "O lead não tem um telefone de WhatsApp válido.";
  if (!activity || activity.lead_id !== lead.id) return "Mensagem prevista não encontrada.";
  if (activity.tipo !== "whatsapp") return "Esta ação não é uma mensagem de WhatsApp.";
  if (activity.status !== "prevista") return "Esta mensagem já foi registrada ou cancelada.";
  if (activity.canal === API_CHANNEL) return ALREADY_SENT_MESSAGE;
  if (CADENCE_KEYS.includes(activity.chave ?? "") && lead.cadencia_status !== "ativa")
    return "A cadência deste lead não está ativa.";
  if (!text.trim()) return "A mensagem está vazia.";
  const missing = unfilledPlaceholders(text);
  if (missing.length) return `Complete antes de enviar: ${missing.join(", ")}`;
  return null;
}

export function sendTextRequest(
  cfg: EvolutionConfig,
  instance: string,
  number: string,
  text: string,
) {
  return {
    url: `${cfg.url}/message/sendText/${encodeURIComponent(instance)}`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", apikey: cfg.apiKey },
      body: JSON.stringify({ number, text }),
    },
  };
}

export function connectionStateRequest(cfg: EvolutionConfig, instance: string) {
  return {
    url: `${cfg.url}/instance/connectionState/${encodeURIComponent(instance)}`,
    init: { method: "GET", headers: { apikey: cfg.apiKey } },
  };
}

/** Aceita as respostas das versões 1 e 2 da Evolution. */
export function isConnected(body: unknown): boolean {
  const b = body as { instance?: { state?: string }; state?: string } | null;
  return (b?.instance?.state ?? b?.state) === "open";
}

export function messageIdFrom(body: unknown): string | null {
  const b = body as { key?: { id?: string } } | null;
  return b?.key?.id ?? null;
}

export function evolutionErrorMessage(status: number, body: unknown): string {
  const text = JSON.stringify(body ?? "");
  if (status === 401 || status === 403)
    return "A Evolution recusou a chave de acesso (EVOLUTION_API_KEY).";
  if (status === 404)
    return "Instância da Evolution não encontrada. Confira o nome cadastrado em Equipe.";
  if (/exists["']?\s*:\s*false|not.*exist/i.test(text))
    return "Este número não tem WhatsApp ou não foi encontrado.";
  if (/connection closed|not connected|disconnected/i.test(text))
    return "O WhatsApp da instância está desconectado. Conecte de novo pelo QR Code.";
  return `A Evolution respondeu com erro ${status}.`;
}
