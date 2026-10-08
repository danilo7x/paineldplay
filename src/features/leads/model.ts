import type { Database } from "@/integrations/supabase/types";

export type Lead = Database["public"]["Tables"]["partner_leads"]["Row"];
export type LeadActivity = Database["public"]["Tables"]["lead_activities"]["Row"];
export type MessageTemplate = Database["public"]["Tables"]["lead_message_templates"]["Row"];

export type LeadStage =
  | "novo"
  | "primeiro_contato"
  | "cadencia"
  | "reuniao"
  | "diagnostico"
  | "proposta"
  | "negociacao"
  | "contrato"
  | "ganho"
  | "perdido"
  | "sem_resposta"
  | "contrato_nao_concluido";

export type FinalStage = "ganho" | "perdido" | "sem_resposta" | "contrato_nao_concluido";

export const FINAL_STAGES: FinalStage[] = [
  "ganho",
  "perdido",
  "sem_resposta",
  "contrato_nao_concluido",
];

export function isFinalStage(etapa: string | null | undefined): etapa is FinalStage {
  return FINAL_STAGES.includes(etapa as FinalStage);
}

export const STAGE_META: Record<LeadStage, { label: string; dot: string; border: string }> = {
  novo: { label: "Novo lead", dot: "bg-sky-400", border: "border-sky-500/40" },
  primeiro_contato: { label: "Primeiro contato", dot: "bg-cyan-400", border: "border-cyan-500/40" },
  cadencia: {
    label: "Cadência de WhatsApp",
    dot: "bg-indigo-400",
    border: "border-indigo-500/40",
  },
  reuniao: {
    label: "Reunião de diagnóstico",
    dot: "bg-violet-400",
    border: "border-violet-500/40",
  },
  diagnostico: { label: "Diagnóstico", dot: "bg-blue-400", border: "border-blue-500/40" },
  proposta: { label: "Proposta", dot: "bg-amber-400", border: "border-amber-500/40" },
  negociacao: { label: "Negociação", dot: "bg-orange-400", border: "border-orange-500/40" },
  contrato: { label: "Contrato", dot: "bg-teal-400", border: "border-teal-500/40" },
  ganho: { label: "Ganho", dot: "bg-emerald-400", border: "border-emerald-500/40" },
  perdido: { label: "Perdido", dot: "bg-red-400", border: "border-red-500/40" },
  sem_resposta: { label: "Sem resposta", dot: "bg-zinc-400", border: "border-zinc-500/40" },
  contrato_nao_concluido: {
    label: "Contrato não concluído",
    dot: "bg-rose-400",
    border: "border-rose-500/40",
  },
};

/** Etapas ativas na ordem do fluxograma TO BE. */
export const ACTIVE_STAGES: LeadStage[] = [
  "novo",
  "primeiro_contato",
  "cadencia",
  "reuniao",
  "diagnostico",
  "proposta",
  "negociacao",
  "contrato",
];

/** Colunas do Kanban. Os encerramentos sem ganho ficam agrupados. */
export const BOARD_COLUMNS: { key: string; label: string; stages: LeadStage[]; border: string }[] =
  [
    ...ACTIVE_STAGES.map((s) => ({
      key: s,
      label: STAGE_META[s].label,
      stages: [s],
      border: STAGE_META[s].border,
    })),
    { key: "ganho", label: "Ganho", stages: ["ganho"], border: STAGE_META.ganho.border },
    {
      key: "encerrados",
      label: "Encerrados",
      stages: ["perdido", "sem_resposta", "contrato_nao_concluido"],
      border: "border-zinc-500/40",
    },
  ];

export function stageLabel(etapa: string | null | undefined) {
  return STAGE_META[etapa as LeadStage]?.label ?? etapa ?? "—";
}

/** Situação detalhada dentro da etapa (subetapa). */
export const SUBSTEP_LABEL: Record<string, string> = {
  template_1: "Enviar 1º template",
  template_2: "Aguardando 2º template",
  template_3: "Aguardando 3º template",
  template_4: "Aguardando 4º template",
  break_up: "Aguardando break-up",
  encerrar_cadencia: "Break-up enviado",
  agendada: "Reunião marcada",
  reagendada: "Reunião reagendada",
  no_show: "No-show",
  cancelada: "Reunião cancelada",
  diagnostico_realizado: "Diagnóstico realizado",
  necessidade_identificada: "Necessidade identificada",
  escopo_definido: "Escopo definido",
  custos_levantados: "Custos levantados",
  proposta_em_preparacao: "Proposta em preparação",
  proposta_pronta: "Proposta pronta",
  apresentacao_agendada: "Apresentação agendada",
  aguardando_decisao: "Aguardando decisão",
  em_negociacao: "Em negociação",
  condicoes_negociadas: "Condições negociadas",
  dados_solicitar: "Solicitar dados cadastrais",
  dados_solicitados: "Dados solicitados",
  dados_recebidos: "Dados recebidos",
  contrato_elaborado: "Contrato elaborado",
  contrato_enviado: "Contrato enviado",
  ajustes_contrato: "Ajustes solicitados",
};

export const CANAL_ORIGEM: { value: string; label: string }[] = [
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "site", label: "Site" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "evento", label: "Evento" },
  { value: "prospeccao_ativa", label: "Prospecção ativa" },
  { value: "outro", label: "Outro" },
];

export function canalLabel(v: string | null | undefined) {
  return CANAL_ORIGEM.find((c) => c.value === v)?.label ?? null;
}

export type CallResult =
  | "atendeu"
  | "nao_atendeu"
  | "pediu_retorno"
  | "respondeu_whatsapp"
  | "reuniao_marcada"
  | "sem_interesse";

export const CALL_RESULTS: { value: CallResult; label: string }[] = [
  { value: "atendeu", label: "Atendeu" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "pediu_retorno", label: "Pediu retorno" },
  { value: "respondeu_whatsapp", label: "Respondeu pelo WhatsApp" },
  { value: "reuniao_marcada", label: "Reunião marcada" },
  { value: "sem_interesse", label: "Sem interesse" },
];

export function callResultLabel(v: string | null | undefined) {
  return CALL_RESULTS.find((c) => c.value === v)?.label ?? v ?? "—";
}

export const MEETING_STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

export const CADENCE_STATUS_LABEL: Record<string, string> = {
  ativa: "Em andamento",
  respondida: "Lead respondeu",
  interrompida: "Interrompida",
  encerrada: "Encerrada",
  optout: "Pediu para não ser contatado",
};

export const CONTACT_CHANNELS: { value: string; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "presencial", label: "Presencial" },
  { value: "outro", label: "Outro" },
];

/** Nome do canal para exibição (inclui o envio automático pela Evolution API). */
export function channelLabel(canal: string | null | undefined) {
  if (!canal) return null;
  if (canal === "whatsapp_api") return "WhatsApp (API)";
  return CONTACT_CHANNELS.find((c) => c.value === canal)?.label ?? canal;
}

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  resposta: "Resposta do lead",
  reuniao: "Reunião",
  marco: "Processo",
  decisao: "Decisão",
  mudanca_etapa: "Etapa",
  nota: "Nota",
  sistema: "Sistema",
  encerramento: "Encerramento",
};

/** Próxima ação: situação em relação a hoje. */
export type DueState = "atrasada" | "hoje" | "futura" | "sem_data";

export function dueState(dataLembrete: string | null | undefined, today: string): DueState {
  if (!dataLembrete) return "sem_data";
  if (dataLembrete < today) return "atrasada";
  if (dataLembrete === today) return "hoje";
  return "futura";
}

type PersonLike = { nome: string | null; email: string | null };

/** Nome do responsável pelo lead: perfil do sistema ou "Outro" (nome digitado). */
export function ownerName(
  lead: Pick<Lead, "responsavel_id" | "responsavel_externo">,
  people: Record<string, PersonLike>,
): string | null {
  if (lead.responsavel_id) {
    const p = people[lead.responsavel_id];
    return p?.nome?.trim() || p?.email || null;
  }
  return lead.responsavel_externo?.trim() || null;
}

/**
 * Quem assina as mensagens: o responsável pelo lead, já que é do número dele
 * que o WhatsApp sai. Sem responsável, as variáveis ficam vazias.
 */
export function senderVars(
  lead: Pick<Lead, "responsavel_id" | "responsavel_externo">,
  people: Record<string, PersonLike>,
): { seuNome: string | null; seuEmail: string | null } {
  const nome = ownerName(lead, people);
  return {
    seuNome: nome ? nome.split(/\s+/)[0] : null,
    seuEmail: lead.responsavel_id ? (people[lead.responsavel_id]?.email ?? null) : null,
  };
}
