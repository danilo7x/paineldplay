import { addBusinessDays, format, set } from "date-fns";

/**
 * Regras da cadência de WhatsApp (roteiro de abordagem DPlay).
 *
 * Após enviar cada mensagem, aguarda-se N dias úteis (segunda a sexta,
 * sem feriados) sem resposta antes do passo seguinte:
 *   1º template → 1 dia útil → 2º → 2 → 3º → 2 → 4º → 3 → break-up
 *   → 2 dias úteis → encerrar como "Sem resposta" (sem nova mensagem).
 * Os prazos podem ser alterados nos modelos (espera_dias_uteis).
 */
export const CADENCE_KEYS = [
  "template_1",
  "template_2",
  "template_3",
  "template_4",
  "break_up",
] as const;
export type CadenceKey = (typeof CADENCE_KEYS)[number];

/** Chave da ação prevista que fecha a cadência sem resposta. */
export const CLOSE_CADENCE_KEY = "encerrar_cadencia";

export const DEFAULT_WAIT_DAYS: Record<CadenceKey, number> = {
  template_1: 1,
  template_2: 2,
  template_3: 2,
  template_4: 3,
  break_up: 2,
};

export const CADENCE_LABEL: Record<CadenceKey, string> = {
  template_1: "1º template",
  template_2: "2º template",
  template_3: "3º template",
  template_4: "4º template",
  break_up: "Break-up",
};

export function isCadenceKey(v: string | null | undefined): v is CadenceKey {
  return CADENCE_KEYS.includes(v as CadenceKey);
}

/** Próximo passo depois de enviar `key`: outro template ou o encerramento. */
export function nextCadenceStep(key: CadenceKey): CadenceKey | typeof CLOSE_CADENCE_KEY {
  const i = CADENCE_KEYS.indexOf(key);
  return i < CADENCE_KEYS.length - 1 ? CADENCE_KEYS[i + 1] : CLOSE_CADENCE_KEY;
}

/** Prazos configurados nos modelos de mensagem (espera_dias_uteis). */
export function waitsFrom(
  templates: { chave: string; espera_dias_uteis: number }[],
): Partial<Record<CadenceKey, number>> {
  const waits: Partial<Record<CadenceKey, number>> = {};
  for (const t of templates) if (isCadenceKey(t.chave)) waits[t.chave] = t.espera_dias_uteis;
  return waits;
}

/** Hora padrão em que um lembrete calculado vence (início do expediente). */
const REMINDER_HOUR = 9;

/** Data em que vence o próximo passo, contando apenas dias úteis. */
export function cadenceDueDate(sentAt: Date, waitDays: number): Date {
  const due = addBusinessDays(sentAt, waitDays);
  return set(due, { hours: REMINDER_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
}

export function toDateOnly(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export type CadenceStepState = "enviada" | "prevista" | "pendente" | "cancelada";

export type CadenceActivityLike = {
  id: string;
  tipo: string;
  status: string;
  chave: string | null;
  ciclo: number | null;
  previsto_para: string | null;
  realizado_em: string | null;
  canal: string | null;
};

export type CadenceStep = {
  key: CadenceKey | typeof CLOSE_CADENCE_KEY;
  state: CadenceStepState;
  sentAt?: string | null;
  dueAt?: string | null;
  canal?: string | null;
  activityId?: string;
};

/**
 * Progresso do ciclo atual a partir do histórico. Uma mensagem só aparece
 * como enviada quando houver registro realizado; a data prevista nunca
 * conta como envio.
 */
export function cadenceProgress(activities: CadenceActivityLike[], ciclo: number): CadenceStep[] {
  const keys = [...CADENCE_KEYS, CLOSE_CADENCE_KEY] as const;
  return keys.map((key) => {
    const mine = activities.filter((a) => a.chave === key && (a.ciclo ?? 0) === ciclo);
    const done = mine.find((a) => a.status === "realizada");
    if (done)
      return {
        key,
        state: "enviada",
        sentAt: done.realizado_em,
        canal: done.canal,
        activityId: done.id,
      };
    const planned = mine.find((a) => a.status === "prevista");
    if (planned)
      return { key, state: "prevista", dueAt: planned.previsto_para, activityId: planned.id };
    const cancelled = mine.find((a) => a.status === "cancelada");
    if (cancelled)
      return { key, state: "cancelada", dueAt: cancelled.previsto_para, activityId: cancelled.id };
    return { key, state: "pendente" };
  });
}

export type TemplateVars = {
  nome?: string | null;
  empresa?: string | null;
  seuNome?: string | null;
  seuEmail?: string | null;
  origem?: string | null;
  linkApresentacao?: string | null;
};

const PLACEHOLDER_RE = /\[([^\]]+)\]/g;

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function firstName(nome: string | null | undefined) {
  return (nome ?? "").trim().split(/\s+/)[0] || null;
}

/**
 * Preenche os campos variáveis conhecidos. O que não tiver valor continua
 * entre colchetes e é devolvido em `missing`, para o usuário completar
 * antes de copiar.
 */
export function personalizeTemplate(text: string, vars: TemplateVars) {
  const lookup: Record<string, string | null | undefined> = {
    nome: firstName(vars.nome),
    "nome do gestor": firstName(vars.nome),
    empresa: vars.empresa,
    "nome da empresa": vars.empresa,
    "seu nome": vars.seuNome,
    "seu email": vars.seuEmail,
    "seu e-mail": vars.seuEmail,
    "origem do contato": vars.origem,
    "origem real do contato": vars.origem,
    "link da apresentacao institucional": vars.linkApresentacao,
  };
  const missing = new Set<string>();
  let out = text.replace(PLACEHOLDER_RE, (match, inner: string) => {
    const value = lookup[normalize(inner)];
    if (value && value.trim()) return value.trim();
    missing.add(match);
    return match;
  });
  // Os modelos 4 e break-up usam "LEAD" como marcador do nome.
  const nome = firstName(vars.nome);
  if (nome) out = out.replace(/\bLEAD\b/g, nome);
  else if (/\bLEAD\b/.test(out)) missing.add("LEAD");
  return { text: out, missing: [...missing] };
}
