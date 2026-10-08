import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { addDays } from "date-fns";
import {
  AlarmClock,
  CalendarCheck2,
  Loader2,
  MessageCircle,
  Plus,
  Siren,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useApplyLeadChange, useLeads, usePeopleMap, useTemplates } from "@/features/leads/api";
import { waitsFrom } from "@/features/leads/cadence";
import { applyLeadFilters, useLeadFilters } from "@/features/leads/filters";
import { LeadBoard } from "@/features/leads/components/LeadBoard";
import { LeadFiltersBar, PageHeader } from "@/features/leads/components/LeadFilters";
import { LeadFormDialog } from "@/features/leads/components/LeadFormDialog";
import { ConfirmDialog, type ConfirmRequest } from "@/features/leads/components/dialog-kit";
import {
  CloseLeadDialog,
  ReopenDialog,
  ScheduleMeetingDialog,
} from "@/features/leads/components/ProcessDialogs";
import { todayStr } from "@/features/leads/format";
import {
  BOARD_COLUMNS,
  STAGE_META,
  dueState,
  isFinalStage,
  type FinalStage,
  type Lead,
  type LeadStage,
} from "@/features/leads/model";
import { moveToStage, startCadence } from "@/features/leads/workflow";

export const Route = createFileRoute("/_authenticated/leads/")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: KanbanPage,
});

function KanbanPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: templates = [] } = useTemplates();
  const { data: people = {} } = usePeopleMap(leads.map((l) => l.responsavel_id));
  const apply = useApplyLeadChange(null);
  const { filters, set, filtered } = useLeadFilters(leads);

  const [formOpen, setFormOpen] = useState(false);
  const [closing, setClosing] = useState<{ lead: Lead; resultado: FinalStage } | null>(null);
  const [reopening, setReopening] = useState<{ lead: Lead; etapa: LeadStage } | null>(null);
  const [meeting, setMeeting] = useState<Lead | null>(null);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const today = todayStr();
  // Os indicadores seguem os filtros da tela (menos o de próxima ação, que eles mesmos aplicam).
  const scoped = applyLeadFilters(leads, { ...filters, action: "todas" }, today);
  const open = scoped.filter((l) => !isFinalStage(l.etapa));
  const overdue = open.filter((l) => dueState(l.data_lembrete, today) === "atrasada");
  const dueToday = open.filter((l) => dueState(l.data_lembrete, today) === "hoje");
  const inCadence = open.filter((l) => l.cadencia_status === "ativa");
  const now = new Date();
  const weekEnd = addDays(now, 7);
  const meetingsSoon = open.filter((l) => {
    if (l.etapa !== "reuniao" || !l.reuniao_em) return false;
    if (!["agendada", "reagendada"].includes(l.reuniao_status ?? "agendada")) return false;
    const at = new Date(l.reuniao_em);
    return at >= now && at <= weekEnd;
  });

  const openLead = (l: Lead) => navigate({ to: "/leads/$id", params: { id: l.id } });

  function handleMove(lead: Lead, columnKey: string) {
    const col = BOARD_COLUMNS.find((c) => c.key === columnKey);
    if (!col || col.stages.includes(lead.etapa as LeadStage)) return;
    const target = col.stages[0];
    if (isFinalStage(target)) {
      setClosing({
        lead,
        resultado:
          columnKey === "ganho" ? "ganho" : lead.etapa === "cadencia" ? "sem_resposta" : "perdido",
      });
      return;
    }
    if (isFinalStage(lead.etapa)) {
      if (target === "cadencia" || target === "reuniao") {
        toast.info("Reabra o lead primeiro e depois inicie a cadência ou marque a reunião.");
        return;
      }
      setReopening({ lead, etapa: target });
      return;
    }
    if (target === "reuniao") {
      setMeeting(lead);
      return;
    }
    if (target === "cadencia") {
      if (lead.nao_contatar) {
        toast.error("Este lead pediu para não receber novos contatos.");
        return;
      }
      const begin = () =>
        apply.mutate(
          {
            id: lead.id,
            change: startCadence(lead, {
              userId: user.id,
              now: new Date(),
              waits: waitsFrom(templates),
            }),
            success: `Cadência iniciada para ${lead.nome}`,
          },
          { onSuccess: () => setConfirming(null) },
        );
      if (["novo", "primeiro_contato"].includes(lead.etapa)) return begin();
      setConfirming({
        title: "Voltar o lead para a cadência?",
        description: `${lead.nome} está em “${STAGE_META[lead.etapa as LeadStage]?.label ?? lead.etapa}”. Iniciar a cadência cancela as ações previstas, inclusive reuniões e apresentações marcadas.`,
        label: "Iniciar cadência",
        onConfirm: begin,
      });
      return;
    }
    const move = () =>
      apply.mutate(
        {
          id: lead.id,
          change: moveToStage(lead, target, { userId: user.id, now: new Date() }),
          success: `${lead.nome} → ${STAGE_META[target].label}`,
        },
        { onSuccess: () => setConfirming(null) },
      );
    // Sair da cadência ou da reunião desfaz o que o processo tinha programado.
    if (lead.etapa === "cadencia" || lead.etapa === "reuniao") {
      setConfirming({
        title: `Mover para “${STAGE_META[target].label}”?`,
        description:
          lead.etapa === "cadencia"
            ? "As mensagens previstas da cadência serão canceladas e a próxima ação vira “Definir o próximo passo”."
            : "A reunião marcada continua na agenda até você registrar o resultado. A próxima ação vira “Definir o próximo passo”.",
        label: "Mover",
        onConfirm: move,
      });
      return;
    }
    move();
  }

  const kpis = [
    {
      key: "atrasadas" as const,
      label: "Atrasadas",
      value: overdue.length,
      icon: Siren,
      tone: "text-red-400",
    },
    {
      key: "hoje" as const,
      label: "Para hoje",
      value: dueToday.length,
      icon: AlarmClock,
      tone: "text-amber-400",
    },
    {
      key: null,
      label: "Em cadência",
      value: inCadence.length,
      icon: MessageCircle,
      tone: "text-indigo-300",
    },
    {
      key: null,
      label: "Reuniões em 7 dias",
      value: meetingsSoon.length,
      icon: CalendarCheck2,
      tone: "text-violet-300",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Kanban"
        description={
          isAdmin
            ? "Processo comercial TO BE: da primeira ligação ao contrato."
            : "Leads atribuídos a você no processo comercial."
        }
        actions={
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Cadastrar lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            disabled={!k.key}
            onClick={() => k.key && set("action", filters.action === k.key ? "todas" : k.key)}
            className={cn(
              "rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4 text-left backdrop-blur-xl transition disabled:cursor-default",
              k.key && "hover:border-primary/40",
              k.key && filters.action === k.key && "border-primary/60",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {k.label}
              </p>
              <k.icon className={cn("size-4", k.tone)} />
            </div>
            <p className="mt-2 text-2xl font-semibold">{k.value}</p>
          </button>
        ))}
      </div>

      {overdue.length + dueToday.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Há {overdue.length + dueToday.length} ação(ões) para hoje ou atrasadas.{" "}
          <Link to="/leads/agenda" className="text-primary hover:underline">
            Ver na Agenda Comercial
          </Link>
        </p>
      )}

      <LeadFiltersBar filters={filters} set={set} isAdmin={isAdmin} />

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border-destructive/40 bg-destructive/5">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar os leads: {(error as Error).message}
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/60 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Target className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Nenhum lead cadastrado ainda." : "Nenhum lead atribuído a você ainda."}
            </p>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" /> Cadastrar lead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="hidden text-xs text-muted-foreground md:block">
            Arraste os cartões entre as colunas. Etapas com regras próprias (cadência, reunião,
            encerramento) pedem os dados necessários antes de mover.
          </p>
          <LeadBoard leads={filtered} people={people} onOpen={openLead} onMove={handleMove} />
        </>
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={null}
        userId={user.id}
        isAdmin={isAdmin}
      />
      {closing && (
        <CloseLeadDialog
          lead={closing.lead}
          userId={user.id}
          open={!!closing}
          onOpenChange={(v) => !v && setClosing(null)}
          initial={closing.resultado}
        />
      )}
      {reopening && (
        <ReopenDialog
          lead={reopening.lead}
          userId={user.id}
          open={!!reopening}
          onOpenChange={(v) => !v && setReopening(null)}
          initial={reopening.etapa}
        />
      )}
      <ConfirmDialog
        request={confirming}
        onClose={() => setConfirming(null)}
        pending={apply.isPending}
      />
      {meeting && (
        <ScheduleMeetingDialog
          lead={meeting}
          userId={user.id}
          open={!!meeting}
          onOpenChange={(v) => !v && setMeeting(null)}
        />
      )}
    </div>
  );
}
