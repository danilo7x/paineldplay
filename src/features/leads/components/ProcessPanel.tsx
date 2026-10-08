import { useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, Circle, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateVars } from "../cadence";
import {
  ACTIVE_STAGES,
  MEETING_STATUS_LABEL,
  isFinalStage,
  type FinalStage,
  type Lead,
  type LeadActivity,
  type LeadStage,
  type MessageTemplate,
} from "../model";
import {
  MILESTONES,
  MILESTONE_GROUPS,
  registerRescheduleAttempt,
  type Decision,
  type MeetingOutcome,
  type Milestone,
} from "../workflow";
import { SendTemplateDialog } from "./CadencePanel";
import {
  CloseLeadDialog,
  DecisionDialog,
  MeetingOutcomeDialog,
  MilestoneDialog,
  ScheduleMeetingDialog,
} from "./ProcessDialogs";
import { SectionCard } from "./shared";
import { formatDateTime, formatMoney } from "../format";

const stageIndex = (s: string) => ACTIVE_STAGES.indexOf(s as LeadStage);

export function ProcessPanel({
  lead,
  activities,
  templates,
  userId,
  vars,
}: {
  lead: Lead;
  activities: LeadActivity[];
  templates: MessageTemplate[];
  userId: string;
  vars: TemplateVars;
}) {
  const [meetingDialog, setMeetingDialog] = useState<null | "nova" | "reagendar">(null);
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [closing, setClosing] = useState<{ resultado: FinalStage; motivo?: string } | null>(null);

  const closed = isFinalStage(lead.etapa);
  const pending = (chave: string) =>
    activities.find((a) => a.status === "prevista" && a.chave === chave) ?? null;
  const pendingMeeting = pending("reuniao_diagnostico");
  const pendingNoShow = pending("no_show");
  const current = stageIndex(lead.etapa);

  const doneMap = useMemo(() => {
    const map = new Map<string, LeadActivity>();
    for (const a of activities) {
      if (a.status !== "realizada" || !a.chave) continue;
      map.set(a.chave, a);
    }
    return map;
  }, [activities]);
  const doneOf = (m: Milestone) =>
    doneMap.get(m.key) ?? (m.completes ? doneMap.get(m.completes) : undefined);

  const facts: [string, string | null][] = [
    ["Necessidade identificada", lead.necessidade_identificada],
    ["Escopo", lead.escopo],
    ["Custos estimados", lead.custos_estimados != null ? formatMoney(lead.custos_estimados) : null],
    ["Preço da proposta", lead.valor_proposta != null ? formatMoney(lead.valor_proposta) : null],
    ["Apresentação", lead.apresentacao_em ? formatDateTime(lead.apresentacao_em) : null],
    ["Condições de pagamento", lead.condicoes_pagamento],
  ];

  return (
    <SectionCard title="Diagnóstico e proposta" icon={ClipboardList}>
      {/* Reunião de diagnóstico */}
      <div className="rounded-xl border border-border/50 bg-background/40 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarCheck2 className="size-3.5" /> Reunião de diagnóstico
            </p>
            {lead.reuniao_em ? (
              <p className="mt-1 text-sm">
                {formatDateTime(lead.reuniao_em)}
                {lead.reuniao_status && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {MEETING_STATUS_LABEL[lead.reuniao_status] ?? lead.reuniao_status}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Ainda não marcada.</p>
            )}
            {lead.reuniao_local && (
              <p className="truncate text-[11px] text-muted-foreground">{lead.reuniao_local}</p>
            )}
          </div>
          {!closed && (
            <div className="flex flex-wrap gap-1.5">
              {pendingMeeting ? (
                <>
                  <Button size="sm" className="h-8" onClick={() => setOutcome("realizada")}>
                    Registrar resultado
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setOutcome("no_show")}
                  >
                    No-show
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setMeetingDialog("reagendar")}
                  >
                    Reagendar
                  </Button>
                </>
              ) : lead.reuniao_status === "no_show" || lead.reuniao_status === "cancelada" ? (
                <>
                  {pendingNoShow && (
                    <Button size="sm" className="h-8" onClick={() => setNoShowOpen(true)}>
                      Template de no-show
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() => setMeetingDialog("reagendar")}
                  >
                    Reagendar reunião
                  </Button>
                </>
              ) : current <= stageIndex("reuniao") ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => setMeetingDialog("nova")}
                >
                  Marcar reunião
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Marcos do processo */}
      <div className="mt-3 space-y-3">
        {MILESTONE_GROUPS.map((g) => {
          const gi = stageIndex(g.stage);
          const isCurrent = lead.etapa === g.stage;
          const past = closed
            ? doneOf(MILESTONES.find((m) => m.stage === g.stage)!) != null
            : gi < current;
          const items = MILESTONES.filter((m) => m.stage === g.stage);
          return (
            <div
              key={g.stage}
              className={cn(
                "rounded-xl border p-3",
                isCurrent ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background/30",
                !isCurrent && !past && "opacity-60",
              )}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
                {isCurrent && (
                  <span className="ml-2 normal-case tracking-normal text-primary">etapa atual</span>
                )}
              </p>
              <ul className="space-y-1.5">
                {items.map((m) => {
                  const done = doneOf(m);
                  return (
                    <li key={m.key} className="flex items-center gap-2 text-sm">
                      {done ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn(!done && "text-muted-foreground")}>{m.label}</span>
                        {done?.realizado_em && (
                          <span className="block text-[11px] text-muted-foreground">
                            {formatDateTime(done.realizado_em)}
                          </span>
                        )}
                      </span>
                      {isCurrent && !closed && (
                        <Button
                          size="sm"
                          variant={done ? "ghost" : "secondary"}
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() => setMilestone(m)}
                        >
                          {done ? "Registrar de novo" : "Registrar"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {isCurrent && !closed && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
                  {g.stage === "proposta" && (
                    <>
                      <span className="w-full text-[11px] text-muted-foreground">
                        Decisão do lead:
                      </span>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => setDecision("proposta_aceita")}
                      >
                        Aprovou
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        onClick={() => setDecision("proposta_negociar")}
                      >
                        Quer negociar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive"
                        onClick={() =>
                          setClosing({ resultado: "perdido", motivo: "Proposta recusada" })
                        }
                      >
                        Recusou
                      </Button>
                    </>
                  )}
                  {g.stage === "negociacao" && (
                    <>
                      <span className="w-full text-[11px] text-muted-foreground">
                        A proposta foi aprovada?
                      </span>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => setDecision("negociacao_aprovada")}
                      >
                        Sim, seguir para contrato
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive"
                        onClick={() =>
                          setClosing({
                            resultado: "perdido",
                            motivo: "Proposta não aprovada após negociação",
                          })
                        }
                      >
                        Não
                      </Button>
                    </>
                  )}
                  {g.stage === "contrato" && (
                    <>
                      <span className="w-full text-[11px] text-muted-foreground">
                        O lead aprovou o contrato?
                      </span>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => setClosing({ resultado: "ganho" })}
                      >
                        Contrato assinado — ganho
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive"
                        onClick={() => setClosing({ resultado: "contrato_nao_concluido" })}
                      >
                        Contrato não concluído
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {facts.some(([, v]) => v) && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-lg bg-background/40 p-2.5">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="whitespace-pre-wrap break-words">{v}</dd>
              </div>
            ))}
        </dl>
      )}

      <ScheduleMeetingDialog
        lead={lead}
        userId={userId}
        open={meetingDialog !== null}
        onOpenChange={(v) => !v && setMeetingDialog(null)}
        reagendamento={meetingDialog === "reagendar"}
      />
      <MeetingOutcomeDialog
        lead={lead}
        userId={userId}
        open={outcome !== null}
        onOpenChange={(v) => !v && setOutcome(null)}
        pendingId={pendingMeeting?.id ?? null}
        initial={outcome ?? undefined}
      />
      {noShowOpen && (
        <SendTemplateDialog
          lead={lead}
          open={noShowOpen}
          onOpenChange={setNoShowOpen}
          template={templates.find((t) => t.chave === "no_show")}
          title="Template de no-show"
          vars={vars}
          build={(input) =>
            registerRescheduleAttempt(
              lead,
              pendingNoShow?.id ?? null,
              { at: input.sentAt, canal: input.canal, observacoes: input.observacoes },
              { userId, now: new Date() },
            )
          }
          success="Tentativa de reagendamento registrada"
          pendingActivityId={pendingNoShow?.id ?? null}
        />
      )}
      <MilestoneDialog
        lead={lead}
        userId={userId}
        open={milestone !== null}
        onOpenChange={(v) => !v && setMilestone(null)}
        milestone={milestone}
        pendingId={
          milestone
            ? (pending(milestone.completes ?? milestone.plans?.chave ?? "__none__")?.id ?? null)
            : null
        }
      />
      <DecisionDialog
        lead={lead}
        userId={userId}
        open={decision !== null}
        onOpenChange={(v) => !v && setDecision(null)}
        decision={decision}
      />
      <CloseLeadDialog
        lead={lead}
        userId={userId}
        open={closing !== null}
        onOpenChange={(v) => !v && setClosing(null)}
        initial={closing?.resultado}
        initialReason={closing?.motivo}
      />
    </SectionCard>
  );
}
