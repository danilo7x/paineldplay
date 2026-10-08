/**
 * Regras do processo comercial TO BE.
 *
 * Cada ação do usuário vira um único `LeadChange`, aplicado de forma atômica
 * pela função `lead_apply_changes` no banco: atualiza o lead, conclui ou
 * cancela ações previstas e registra o histórico na mesma transação. A
 * mudança de etapa em si é registrada por gatilho no banco, para que o funil
 * e a linha do tempo nunca divirjam.
 */
import { format } from "date-fns";
import {
  CADENCE_LABEL,
  CLOSE_CADENCE_KEY,
  DEFAULT_WAIT_DAYS,
  cadenceDueDate,
  nextCadenceStep,
  toDateOnly,
  type CadenceKey,
} from "./cadence";
import {
  callResultLabel,
  stageLabel,
  type CallResult,
  type FinalStage,
  type Lead,
  type LeadStage,
} from "./model";

export type NewActivity = {
  tipo: string;
  status?: "realizada" | "prevista";
  titulo: string;
  resultado?: string | null;
  observacoes?: string | null;
  canal?: string | null;
  chave?: string | null;
  ciclo?: number | null;
  previsto_para?: string | null;
  realizado_em?: string | null;
  responsavel_id?: string | null;
};

export type ActivityUpdate = {
  id: string;
  status?: "realizada" | "prevista" | "cancelada";
  titulo?: string;
  realizado_em?: string | null;
  previsto_para?: string | null;
  resultado?: string | null;
  observacoes?: string | null;
  canal?: string | null;
};

export type LeadPatch = Partial<Omit<Lead, "id" | "created_at" | "created_by" | "updated_at">>;

export type LeadChange = {
  patch: LeadPatch;
  activities: NewActivity[];
  updates: ActivityUpdate[];
  cancelPending: boolean;
};

export type WorkflowCtx = {
  userId: string;
  now: Date;
  waits?: Partial<Record<CadenceKey, number>>;
};

const empty = (): LeadChange => ({ patch: {}, activities: [], updates: [], cancelPending: false });

export function mergeChanges(...changes: LeadChange[]): LeadChange {
  return changes.reduce(
    (acc, c) => ({
      patch: { ...acc.patch, ...c.patch },
      activities: [...acc.activities, ...c.activities],
      updates: [...acc.updates, ...c.updates],
      cancelPending: acc.cancelPending || c.cancelPending,
    }),
    empty(),
  );
}

const iso = (d: Date) => d.toISOString();
const fmt = (d: Date) => format(d, "dd/MM/yyyy 'às' HH:mm");

function owner(lead: Lead, ctx: WorkflowCtx) {
  return lead.responsavel_id ?? ctx.userId;
}

function nextAction(lead: Lead, ctx: WorkflowCtx, text: string, when: Date): LeadPatch {
  return {
    proximo_passo: text,
    data_lembrete: toDateOnly(when),
    proxima_acao_responsavel_id: owner(lead, ctx),
  };
}

/** Etapas em que uma conversa iniciada leva o lead para "Primeiro contato". */
const EARLY_STAGES: string[] = ["novo", "primeiro_contato", "cadencia"];

function answeredPatch(lead: Lead): LeadPatch {
  return {
    ...(EARLY_STAGES.includes(lead.etapa) ? { etapa: "primeiro_contato", subetapa: null } : {}),
    ...(lead.cadencia_status === "ativa" ? { cadencia_status: "respondida" } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Cadência de WhatsApp                                               */
/* ------------------------------------------------------------------ */

export function startCadence(lead: Lead, ctx: WorkflowCtx, at: Date = ctx.now): LeadChange {
  const ciclo = (lead.cadencia_ciclo ?? 0) + 1;
  return {
    cancelPending: true,
    updates: [],
    patch: {
      etapa: "cadencia",
      subetapa: "template_1",
      cadencia_status: "ativa",
      cadencia_ciclo: ciclo,
      ...nextAction(lead, ctx, "Enviar 1º template de WhatsApp", at),
    },
    activities: [
      {
        tipo: "sistema",
        titulo: "Cadência de WhatsApp iniciada",
        resultado: ciclo > 1 ? `Ciclo ${ciclo}` : null,
        realizado_em: iso(ctx.now),
      },
      {
        tipo: "whatsapp",
        status: "prevista",
        titulo: "Enviar 1º template",
        chave: "template_1",
        ciclo,
        previsto_para: iso(at),
        responsavel_id: owner(lead, ctx),
      },
    ],
  };
}

export function registerTemplateSent(
  lead: Lead,
  key: CadenceKey,
  pendingId: string | null,
  input: { sentAt: Date; canal: string; observacoes?: string },
  ctx: WorkflowCtx,
): LeadChange {
  const ciclo = lead.cadencia_ciclo ?? 1;
  const titulo = `${CADENCE_LABEL[key]} enviado`;
  const sent: Pick<LeadChange, "updates" | "activities"> = pendingId
    ? {
        updates: [
          {
            id: pendingId,
            status: "realizada",
            titulo,
            realizado_em: iso(input.sentAt),
            canal: input.canal,
            observacoes: input.observacoes || null,
          },
        ],
        activities: [],
      }
    : {
        updates: [],
        activities: [
          {
            tipo: "whatsapp",
            titulo,
            chave: key,
            ciclo,
            canal: input.canal,
            observacoes: input.observacoes || null,
            realizado_em: iso(input.sentAt),
          },
        ],
      };

  const wait = ctx.waits?.[key] ?? DEFAULT_WAIT_DAYS[key];
  const due = cadenceDueDate(input.sentAt, wait);
  const next = nextCadenceStep(key);

  if (next === CLOSE_CADENCE_KEY) {
    return {
      cancelPending: false,
      updates: sent.updates,
      patch: {
        subetapa: CLOSE_CADENCE_KEY,
        ...nextAction(lead, ctx, 'Sem resposta ao break-up: encerrar como "Sem resposta"', due),
      },
      activities: [
        ...sent.activities,
        {
          tipo: "encerramento",
          status: "prevista",
          titulo: 'Encerrar cadência como "Sem resposta"',
          chave: CLOSE_CADENCE_KEY,
          ciclo,
          previsto_para: iso(due),
          responsavel_id: owner(lead, ctx),
        },
      ],
    };
  }

  return {
    cancelPending: false,
    updates: sent.updates,
    patch: {
      subetapa: next,
      ...nextAction(lead, ctx, `Enviar ${CADENCE_LABEL[next]} se não houver resposta`, due),
    },
    activities: [
      ...sent.activities,
      {
        tipo: "whatsapp",
        status: "prevista",
        titulo: `Enviar ${CADENCE_LABEL[next]}`,
        chave: next,
        ciclo,
        previsto_para: iso(due),
        responsavel_id: owner(lead, ctx),
      },
    ],
  };
}

export function closeCadenceWithoutResponse(
  lead: Lead,
  pendingId: string | null,
  ctx: WorkflowCtx,
): LeadChange {
  const titulo = "Cadência encerrada sem resposta";
  return {
    cancelPending: true,
    patch: {
      etapa: "sem_resposta",
      cadencia_status: "encerrada",
      motivo_encerramento: "Sem resposta após o break-up",
    },
    updates: pendingId
      ? [{ id: pendingId, status: "realizada", titulo, realizado_em: iso(ctx.now) }]
      : [],
    activities: pendingId
      ? []
      : [{ tipo: "encerramento", titulo, chave: CLOSE_CADENCE_KEY, realizado_em: iso(ctx.now) }],
  };
}

/* ------------------------------------------------------------------ */
/* Reunião de diagnóstico                                             */
/* ------------------------------------------------------------------ */

export function scheduleMeeting(
  lead: Lead,
  input: { at: Date; local?: string; observacoes?: string; reagendamento?: boolean },
  ctx: WorkflowCtx,
): LeadChange {
  const status = input.reagendamento ? "reagendada" : "agendada";
  return {
    cancelPending: true,
    updates: [],
    patch: {
      etapa: "reuniao",
      subetapa: status,
      reuniao_em: iso(input.at),
      reuniao_status: status,
      reuniao_local: input.local || null,
      ...(lead.cadencia_status === "ativa" ? { cadencia_status: "respondida" } : {}),
      ...nextAction(lead, ctx, "Realizar a reunião de diagnóstico", input.at),
    },
    activities: [
      {
        tipo: "reuniao",
        titulo: input.reagendamento
          ? "Reunião de diagnóstico reagendada"
          : "Reunião de diagnóstico marcada",
        resultado: `Para ${fmt(input.at)}`,
        observacoes: [input.local, input.observacoes].filter(Boolean).join("\n") || null,
        realizado_em: iso(ctx.now),
      },
      {
        tipo: "reuniao",
        status: "prevista",
        titulo: "Reunião de diagnóstico",
        chave: "reuniao_diagnostico",
        previsto_para: iso(input.at),
        responsavel_id: owner(lead, ctx),
      },
    ],
  };
}

export type MeetingOutcome = "realizada" | "no_show" | "cancelada";

export function registerMeetingOutcome(
  lead: Lead,
  pendingId: string | null,
  input: { outcome: MeetingOutcome; at: Date; observacoes?: string; necessidade?: string },
  ctx: WorkflowCtx,
): LeadChange {
  const obs = input.observacoes || null;
  if (input.outcome === "realizada") {
    const titulo = "Reunião de diagnóstico realizada";
    return {
      cancelPending: false,
      patch: {
        etapa: "diagnostico",
        subetapa: "diagnostico_realizado",
        reuniao_status: "realizada",
        ...(input.necessidade ? { necessidade_identificada: input.necessidade } : {}),
        ...nextAction(lead, ctx, "Definir o escopo", cadenceDueDate(input.at, 1)),
      },
      updates: pendingId
        ? [
            {
              id: pendingId,
              status: "realizada",
              titulo,
              realizado_em: iso(input.at),
              resultado: "Realizada",
              observacoes: obs,
            },
          ]
        : [],
      activities: pendingId
        ? []
        : [
            {
              tipo: "reuniao",
              titulo,
              resultado: "Realizada",
              observacoes: obs,
              realizado_em: iso(input.at),
            },
          ],
    };
  }

  if (input.outcome === "no_show") {
    return {
      cancelPending: false,
      patch: {
        subetapa: "no_show",
        reuniao_status: "no_show",
        ...nextAction(lead, ctx, "Enviar template de no-show e tentar reagendar", ctx.now),
      },
      updates: pendingId ? [{ id: pendingId, status: "cancelada", resultado: "No-show" }] : [],
      activities: [
        {
          tipo: "reuniao",
          titulo: "No-show na reunião de diagnóstico",
          resultado: "No-show",
          observacoes: obs,
          realizado_em: iso(input.at),
        },
        {
          tipo: "whatsapp",
          status: "prevista",
          titulo: "Enviar template de no-show e tentar reagendar",
          chave: "no_show",
          previsto_para: iso(ctx.now),
          responsavel_id: owner(lead, ctx),
        },
      ],
    };
  }

  return {
    cancelPending: false,
    patch: {
      subetapa: "cancelada",
      reuniao_status: "cancelada",
      ...nextAction(lead, ctx, "Remarcar a reunião de diagnóstico", cadenceDueDate(ctx.now, 1)),
    },
    updates: pendingId ? [{ id: pendingId, status: "cancelada", resultado: "Cancelada" }] : [],
    activities: [
      {
        tipo: "reuniao",
        titulo: "Reunião de diagnóstico cancelada",
        resultado: "Cancelada",
        observacoes: obs,
        realizado_em: iso(input.at),
      },
    ],
  };
}

/** Registra o envio do template de no-show / tentativa de reagendar. */
export function registerRescheduleAttempt(
  lead: Lead,
  pendingId: string | null,
  input: { at: Date; canal: string; observacoes?: string },
  ctx: WorkflowCtx,
): LeadChange {
  const titulo = "Tentativa de reagendamento (template de no-show)";
  return {
    cancelPending: false,
    patch: nextAction(
      lead,
      ctx,
      "Aguardar retorno e reagendar a reunião",
      cadenceDueDate(input.at, 1),
    ),
    updates: pendingId
      ? [
          {
            id: pendingId,
            status: "realizada",
            titulo,
            realizado_em: iso(input.at),
            canal: input.canal,
            observacoes: input.observacoes || null,
          },
        ]
      : [],
    activities: pendingId
      ? []
      : [
          {
            tipo: "whatsapp",
            titulo,
            canal: input.canal,
            observacoes: input.observacoes || null,
            realizado_em: iso(input.at),
          },
        ],
  };
}

/* ------------------------------------------------------------------ */
/* Primeira ligação e respostas                                       */
/* ------------------------------------------------------------------ */

export type CallInput = {
  at: Date;
  resultado: CallResult;
  observacoes?: string;
  necessidade?: string;
  /** reunião marcada na ligação */
  meetingAt?: Date;
  meetingLocal?: string;
  /** retorno pedido pelo lead */
  callbackAt?: Date;
  /** não atendeu: iniciar a cadência de WhatsApp */
  startCadence?: boolean;
  /** próxima ação definida pelo usuário (atendeu / respondeu) */
  nextText?: string;
  nextAt?: Date;
  /** retorno previsto que esta ligação cumpre */
  pendingCallbackId?: string | null;
};

export function registerCall(lead: Lead, input: CallInput, ctx: WorkflowCtx): LeadChange {
  const first = !lead.data_primeiro_contato;
  const label = callResultLabel(input.resultado);
  const titulo = first ? "Primeira ligação" : "Ligação";
  const obs = input.observacoes || null;

  const base: LeadChange = {
    cancelPending: false,
    patch: {
      ...(first
        ? { data_primeiro_contato: iso(input.at), resultado_primeira_ligacao: input.resultado }
        : {}),
      ...(input.necessidade ? { necessidade_inicial: input.necessidade } : {}),
    },
    updates: input.pendingCallbackId
      ? [
          {
            id: input.pendingCallbackId,
            status: "realizada",
            titulo,
            realizado_em: iso(input.at),
            resultado: label,
            observacoes: obs,
          },
        ]
      : [],
    activities: input.pendingCallbackId
      ? []
      : [
          {
            tipo: "ligacao",
            titulo,
            resultado: label,
            observacoes: obs,
            realizado_em: iso(input.at),
          },
        ],
  };

  const followUp = (text: string) =>
    nextAction(lead, ctx, input.nextText || text, input.nextAt ?? cadenceDueDate(input.at, 1));

  switch (input.resultado) {
    case "reuniao_marcada": {
      if (!input.meetingAt) throw new Error("Informe a data da reunião");
      return mergeChanges(
        base,
        scheduleMeeting(lead, { at: input.meetingAt, local: input.meetingLocal }, ctx),
      );
    }
    case "sem_interesse":
      return mergeChanges(
        base,
        closeLead(lead, { resultado: "perdido", motivo: "Sem interesse na ligação" }, ctx),
      );
    case "pediu_retorno": {
      if (!input.callbackAt) throw new Error("Informe quando retornar");
      return mergeChanges(base, {
        cancelPending: lead.cadencia_status === "ativa",
        updates: [],
        patch: {
          ...answeredPatch(lead),
          ...nextAction(lead, ctx, "Retornar a ligação", input.callbackAt),
        },
        activities: [
          {
            tipo: "ligacao",
            status: "prevista",
            titulo: "Retornar a ligação",
            chave: "retorno_ligacao",
            previsto_para: iso(input.callbackAt),
            responsavel_id: owner(lead, ctx),
          },
        ],
      });
    }
    case "atendeu":
      return mergeChanges(base, {
        cancelPending: lead.cadencia_status === "ativa",
        updates: [],
        activities: [],
        patch: { ...answeredPatch(lead), ...followUp("Definir o próximo passo com o lead") },
      });
    case "respondeu_whatsapp":
      return mergeChanges(base, {
        cancelPending: lead.cadencia_status === "ativa",
        updates: [],
        activities: [],
        patch: { ...answeredPatch(lead), ...followUp("Dar continuidade à conversa no WhatsApp") },
      });
    case "nao_atendeu": {
      const canStart = input.startCadence && lead.cadencia_status !== "ativa" && !lead.nao_contatar;
      if (canStart) return mergeChanges(base, startCadence(lead, ctx, input.at));
      return mergeChanges(base, {
        cancelPending: false,
        updates: [],
        activities: [],
        patch: {
          ...(lead.etapa === "novo" ? { etapa: "primeiro_contato" } : {}),
          ...(lead.cadencia_status === "ativa" ? {} : followUp("Nova tentativa de ligação")),
        },
      });
    }
  }
}

export type ResponseOutcome = "interesse" | "conversa" | "sem_interesse" | "optout";

export const RESPONSE_OUTCOMES: { value: ResponseOutcome; label: string }[] = [
  { value: "interesse", label: "Demonstrou interesse" },
  { value: "conversa", label: "Respondeu, conversa em andamento" },
  { value: "sem_interesse", label: "Não tem interesse" },
  { value: "optout", label: "Pediu para não receber novos contatos" },
];

export function registerResponse(
  lead: Lead,
  input: {
    at: Date;
    canal: string;
    resumo?: string;
    desfecho: ResponseOutcome;
    meetingAt?: Date;
    meetingLocal?: string;
    nextText?: string;
    nextAt?: Date;
  },
  ctx: WorkflowCtx,
): LeadChange {
  const base: LeadChange = {
    // A resposta interrompe tudo o que estava previsto na cadência.
    cancelPending: true,
    updates: [],
    patch: lead.cadencia_status === "ativa" ? { cadencia_status: "respondida" } : {},
    activities: [
      {
        tipo: "resposta",
        titulo: "Lead respondeu",
        canal: input.canal,
        resultado: RESPONSE_OUTCOMES.find((o) => o.value === input.desfecho)?.label ?? null,
        observacoes: input.resumo || null,
        realizado_em: iso(input.at),
      },
    ],
  };

  if (input.desfecho === "optout") {
    return mergeChanges(
      base,
      closeLead(
        lead,
        { resultado: "perdido", motivo: "Pediu para não receber novos contatos" },
        ctx,
      ),
      {
        cancelPending: true,
        updates: [],
        activities: [],
        patch: { nao_contatar: true, cadencia_status: "optout" },
      },
    );
  }
  if (input.desfecho === "sem_interesse") {
    return mergeChanges(
      base,
      closeLead(lead, { resultado: "perdido", motivo: "Respondeu sem interesse" }, ctx),
    );
  }
  if (input.desfecho === "interesse" && input.meetingAt) {
    return mergeChanges(
      base,
      scheduleMeeting(lead, { at: input.meetingAt, local: input.meetingLocal }, ctx),
    );
  }
  return mergeChanges(base, {
    cancelPending: true,
    updates: [],
    activities: [],
    patch: {
      ...answeredPatch(lead),
      ...nextAction(
        lead,
        ctx,
        input.nextText ||
          (input.desfecho === "interesse"
            ? "Marcar a reunião de diagnóstico"
            : "Dar continuidade à conversa"),
        input.nextAt ?? cadenceDueDate(input.at, 1),
      ),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Diagnóstico, proposta, negociação e contrato                       */
/* ------------------------------------------------------------------ */

export type MilestoneField = {
  name:
    | "necessidade_identificada"
    | "escopo"
    | "custos_estimados"
    | "valor_proposta"
    | "apresentacao_em"
    | "condicoes_pagamento";
  label: string;
  kind: "textarea" | "money" | "datetime";
  required?: boolean;
};

export type Milestone = {
  key: string;
  label: string;
  stage: LeadStage;
  fields?: MilestoneField[];
  requireNotes?: boolean;
  subetapa: string;
  moveTo?: LeadStage;
  next: { text: string; businessDays?: number; atField?: "apresentacao_em" };
  /** cria uma ação prevista na data do campo */
  plans?: { chave: string; titulo: string; tipo: string };
  /** conclui a ação prevista com esta chave */
  completes?: string;
};

export const MILESTONE_GROUPS: { stage: LeadStage; label: string }[] = [
  { stage: "diagnostico", label: "Diagnóstico" },
  { stage: "proposta", label: "Proposta" },
  { stage: "negociacao", label: "Negociação" },
  { stage: "contrato", label: "Contrato" },
];

export const MILESTONES: Milestone[] = [
  {
    key: "necessidade_identificada",
    label: "Necessidade identificada",
    stage: "diagnostico",
    subetapa: "necessidade_identificada",
    fields: [
      {
        name: "necessidade_identificada",
        label: "Necessidade identificada",
        kind: "textarea",
        required: true,
      },
    ],
    next: { text: "Definir o escopo", businessDays: 1 },
  },
  {
    key: "escopo_definido",
    label: "Escopo definido",
    stage: "diagnostico",
    subetapa: "escopo_definido",
    fields: [{ name: "escopo", label: "Escopo", kind: "textarea", required: true }],
    next: { text: "Levantar os custos", businessDays: 1 },
  },
  {
    key: "custos_levantados",
    label: "Custos levantados",
    stage: "diagnostico",
    subetapa: "custos_levantados",
    fields: [
      { name: "custos_estimados", label: "Custos estimados (R$)", kind: "money", required: true },
    ],
    next: { text: "Definir o preço", businessDays: 1 },
  },
  {
    key: "preco_definido",
    label: "Preço definido e dados comerciais atualizados",
    stage: "diagnostico",
    subetapa: "proposta_em_preparacao",
    moveTo: "proposta",
    fields: [
      { name: "valor_proposta", label: "Preço da proposta (R$)", kind: "money", required: true },
    ],
    next: { text: "Preparar a proposta", businessDays: 1 },
  },
  {
    key: "proposta_preparada",
    label: "Proposta preparada",
    stage: "proposta",
    subetapa: "proposta_pronta",
    next: { text: "Agendar a apresentação da proposta", businessDays: 1 },
  },
  {
    key: "apresentacao_agendada",
    label: "Apresentação agendada",
    stage: "proposta",
    subetapa: "apresentacao_agendada",
    fields: [
      {
        name: "apresentacao_em",
        label: "Data e hora da apresentação",
        kind: "datetime",
        required: true,
      },
    ],
    plans: { chave: "apresentacao_proposta", titulo: "Apresentação da proposta", tipo: "reuniao" },
    next: { text: "Apresentar a proposta", atField: "apresentacao_em" },
  },
  {
    key: "apresentacao_realizada",
    label: "Proposta apresentada",
    stage: "proposta",
    subetapa: "aguardando_decisao",
    completes: "apresentacao_proposta",
    next: { text: "Registrar a decisão do lead sobre a proposta", businessDays: 2 },
  },
  {
    key: "condicoes_negociadas",
    label: "Condições de pagamento negociadas",
    stage: "negociacao",
    subetapa: "condicoes_negociadas",
    fields: [
      {
        name: "condicoes_pagamento",
        label: "Condições de pagamento",
        kind: "textarea",
        required: true,
      },
    ],
    next: { text: "Registrar se a proposta foi aprovada", businessDays: 2 },
  },
  {
    key: "dados_solicitados",
    label: "Dados cadastrais solicitados",
    stage: "contrato",
    subetapa: "dados_solicitados",
    next: { text: "Aguardar os dados cadastrais", businessDays: 2 },
  },
  {
    key: "dados_recebidos",
    label: "Dados cadastrais recebidos",
    stage: "contrato",
    subetapa: "dados_recebidos",
    next: { text: "Elaborar o contrato", businessDays: 1 },
  },
  {
    key: "contrato_elaborado",
    label: "Contrato elaborado",
    stage: "contrato",
    subetapa: "contrato_elaborado",
    next: { text: "Enviar o contrato", businessDays: 1 },
  },
  {
    key: "contrato_enviado",
    label: "Contrato enviado",
    stage: "contrato",
    subetapa: "contrato_enviado",
    next: { text: "Acompanhar o retorno do contrato", businessDays: 2 },
  },
  {
    key: "ajustes_solicitados",
    label: "Ajustes contratuais solicitados",
    stage: "contrato",
    subetapa: "ajustes_contrato",
    requireNotes: true,
    next: { text: "Realizar os ajustes e reenviar o contrato", businessDays: 1 },
  },
];

export type MilestoneValues = Partial<Record<MilestoneField["name"], string>>;

export function registerMilestone(
  lead: Lead,
  m: Milestone,
  input: { at: Date; observacoes?: string; values: MilestoneValues; pendingId?: string | null },
  ctx: WorkflowCtx,
): LeadChange {
  const patch: LeadPatch = { subetapa: m.subetapa };
  if (m.moveTo) patch.etapa = m.moveTo;
  const resumo: string[] = [];
  for (const f of m.fields ?? []) {
    const raw = input.values[f.name]?.trim();
    if (!raw) {
      if (f.required) throw new Error(`Preencha: ${f.label}`);
      continue;
    }
    if (f.kind === "money") {
      const n = Number(raw.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`Valor inválido: ${f.label}`);
      (patch as Record<string, unknown>)[f.name] = n;
      resumo.push(`${f.label}: R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    } else if (f.kind === "datetime") {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${f.label}`);
      (patch as Record<string, unknown>)[f.name] = d.toISOString();
      resumo.push(`${f.label}: ${fmt(d)}`);
    } else {
      (patch as Record<string, unknown>)[f.name] = raw;
      resumo.push(`${f.label}: ${raw}`);
    }
  }
  if (m.requireNotes && !input.observacoes?.trim()) throw new Error("Descreva o que foi pedido");

  const nextAt =
    m.next.atField && patch[m.next.atField]
      ? new Date(patch[m.next.atField] as string)
      : cadenceDueDate(input.at, m.next.businessDays ?? 1);
  Object.assign(patch, nextAction(lead, ctx, m.next.text, nextAt));

  const obs = [resumo.join("\n"), input.observacoes?.trim()].filter(Boolean).join("\n\n") || null;
  const change: LeadChange = {
    cancelPending: false,
    patch,
    updates: [],
    activities: [],
  };
  if (m.completes && input.pendingId) {
    change.updates.push({
      id: input.pendingId,
      status: "realizada",
      titulo: m.label,
      realizado_em: iso(input.at),
      observacoes: obs,
    });
  } else {
    change.activities.push({
      tipo: "marco",
      titulo: m.label,
      chave: m.key,
      observacoes: obs,
      realizado_em: iso(input.at),
    });
  }
  if (m.plans && patch.apresentacao_em) {
    // Remarcar a apresentação substitui a anterior.
    if (input.pendingId)
      change.updates.push({ id: input.pendingId, status: "cancelada", resultado: "Remarcada" });
    change.activities.push({
      tipo: m.plans.tipo,
      status: "prevista",
      titulo: m.plans.titulo,
      chave: m.plans.chave,
      previsto_para: patch.apresentacao_em as string,
      responsavel_id: owner(lead, ctx),
    });
  }
  return change;
}

export type Decision = "proposta_aceita" | "proposta_negociar" | "negociacao_aprovada";

export function registerDecision(
  lead: Lead,
  decision: Decision,
  input: { at: Date; observacoes?: string },
  ctx: WorkflowCtx,
): LeadChange {
  const obs = input.observacoes || null;
  const at = iso(input.at);
  if (decision === "proposta_negociar") {
    return {
      cancelPending: false,
      updates: [],
      activities: [
        {
          tipo: "decisao",
          titulo: "Lead pediu para negociar a proposta",
          resultado: "Negociar condições",
          observacoes: obs,
          realizado_em: at,
        },
      ],
      patch: {
        etapa: "negociacao",
        subetapa: "em_negociacao",
        ...nextAction(lead, ctx, "Negociar as condições de pagamento", cadenceDueDate(input.at, 1)),
      },
    };
  }
  const titulo =
    decision === "proposta_aceita"
      ? "Lead aprovou a proposta"
      : "Proposta aprovada após negociação";
  return {
    cancelPending: false,
    updates: [],
    activities: [
      { tipo: "decisao", titulo, resultado: "Aprovada", observacoes: obs, realizado_em: at },
    ],
    patch: {
      etapa: "contrato",
      subetapa: "dados_solicitar",
      ...nextAction(lead, ctx, "Solicitar os dados cadastrais", input.at),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Encerramento, reabertura e ajustes                                 */
/* ------------------------------------------------------------------ */

export function closeLead(
  lead: Lead,
  input: {
    resultado: FinalStage;
    motivo?: string;
    at?: Date;
    clientId?: string | null;
    /** ganho: data da assinatura, quando ainda não registrada */
    contratoAssinadoEm?: Date | null;
  },
  ctx: WorkflowCtx,
): LeadChange {
  const at = iso(input.at ?? ctx.now);
  const activities: NewActivity[] = [];
  if (input.resultado === "ganho" && input.contratoAssinadoEm) {
    activities.push({
      tipo: "marco",
      titulo: "Contrato assinado",
      chave: "contrato_assinado",
      realizado_em: iso(input.contratoAssinadoEm),
    });
  }
  activities.push({
    tipo: "encerramento",
    titulo: `Lead encerrado: ${stageLabel(input.resultado)}`,
    resultado: stageLabel(input.resultado),
    observacoes: input.motivo || null,
    realizado_em: at,
  });
  return {
    cancelPending: true,
    updates: [],
    activities,
    patch: {
      etapa: input.resultado,
      subetapa: null,
      motivo_encerramento: input.motivo || null,
      ...(input.resultado === "ganho" && input.clientId !== undefined
        ? { client_id: input.clientId }
        : {}),
    },
  };
}

export function reopenLead(
  lead: Lead,
  etapa: LeadStage,
  motivo: string,
  ctx: WorkflowCtx,
): LeadChange {
  return {
    cancelPending: false,
    updates: [],
    activities: [
      {
        tipo: "sistema",
        titulo: "Lead reaberto",
        resultado: `Resultado anterior: ${stageLabel(lead.etapa)}`,
        observacoes: motivo || null,
        realizado_em: iso(ctx.now),
      },
    ],
    patch: {
      etapa,
      subetapa: null,
      motivo_encerramento: null,
      ...nextAction(lead, ctx, "Definir o próximo passo", ctx.now),
    },
  };
}

/** Movimento livre no Kanban para uma etapa ativa sem regras próprias. */
export function moveToStage(etapa: LeadStage): LeadChange {
  return { cancelPending: false, updates: [], activities: [], patch: { etapa, subetapa: null } };
}

export function setNextAction(input: {
  texto: string;
  data: string | null;
  responsavelId: string | null;
}): LeadChange {
  return {
    cancelPending: false,
    updates: [],
    activities: [],
    patch: {
      proximo_passo: input.texto || null,
      data_lembrete: input.data || null,
      proxima_acao_responsavel_id: input.responsavelId,
    },
  };
}

/** Ajuste manual da data de uma ação prevista (ex.: próximo template). */
export function reschedulePlanned(
  activityId: string,
  at: Date,
  alsoNextAction: boolean,
): LeadChange {
  return {
    cancelPending: false,
    activities: [],
    updates: [{ id: activityId, previsto_para: iso(at) }],
    patch: alsoNextAction ? { data_lembrete: toDateOnly(at) } : {},
  };
}

export function addNote(input: {
  tipo: string;
  titulo: string;
  observacoes?: string;
  at: Date;
  canal?: string | null;
}): LeadChange {
  return {
    cancelPending: false,
    updates: [],
    patch: {},
    activities: [
      {
        tipo: input.tipo,
        titulo: input.titulo,
        canal: input.canal ?? null,
        observacoes: input.observacoes || null,
        realizado_em: iso(input.at),
      },
    ],
  };
}
