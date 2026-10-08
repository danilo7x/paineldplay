import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import {
  AlarmClock,
  CalendarCheck2,
  Columns3,
  List,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Siren,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useApplyLeadChange,
  useLeads,
  usePeopleMap,
  useCommercialPeople,
  useTemplates,
} from "@/features/leads/api";
import { waitsFrom } from "@/features/leads/cadence";
import { LeadBoard, LeadList } from "@/features/leads/components/LeadBoard";
import { LeadFormDialog } from "@/features/leads/components/LeadFormDialog";
import {
  CloseLeadDialog,
  ReopenDialog,
  ScheduleMeetingDialog,
} from "@/features/leads/components/ProcessDialogs";
import { TemplatesDialog } from "@/features/leads/components/ScriptAndTemplates";
import { DueBadge } from "@/features/leads/components/shared";
import { todayStr } from "@/features/leads/format";
import {
  ACTIVE_STAGES,
  BOARD_COLUMNS,
  FINAL_STAGES,
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
  component: LeadsPage,
});

type ActionFilter = "todas" | "atrasadas" | "hoje" | "hoje_atrasadas" | "semana" | "sem_acao";

function LeadsPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: templates = [] } = useTemplates();
  const { data: commercialPeople = [] } = useCommercialPeople();
  const { data: people = {} } = usePeopleMap(leads.map((l) => l.responsavel_id));
  const apply = useApplyLeadChange(null);

  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("todas");
  const [owner, setOwner] = useState<string>("todos");
  const [action, setAction] = useState<ActionFilter>("todas");
  const [formOpen, setFormOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [closing, setClosing] = useState<{ lead: Lead; resultado: FinalStage } | null>(null);
  const [reopening, setReopening] = useState<{ lead: Lead; etapa: LeadStage } | null>(null);
  const [meeting, setMeeting] = useState<Lead | null>(null);

  const today = todayStr();
  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q) {
        const hay = [l.nome, l.empresa, l.contato, l.telefone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (stage === "ativas" && isFinalStage(l.etapa)) return false;
      if (stage === "encerradas" && !isFinalStage(l.etapa)) return false;
      if (!["todas", "ativas", "encerradas"].includes(stage) && l.etapa !== stage) return false;
      if (owner === "sem" && l.responsavel_id) return false;
      if (!["todos", "sem"].includes(owner) && l.responsavel_id !== owner) return false;
      if (action !== "todas") {
        if (isFinalStage(l.etapa)) return false;
        const d = dueState(l.data_lembrete, today);
        if (action === "atrasadas" && d !== "atrasada") return false;
        if (action === "hoje" && d !== "hoje") return false;
        if (action === "hoje_atrasadas" && d !== "hoje" && d !== "atrasada") return false;
        if (action === "semana" && (!l.data_lembrete || l.data_lembrete > weekEnd)) return false;
        if (action === "sem_acao" && l.data_lembrete) return false;
      }
      return true;
    });
  }, [leads, search, stage, owner, action, today, weekEnd]);

  const open = leads.filter((l) => !isFinalStage(l.etapa));
  const overdue = open.filter((l) => dueState(l.data_lembrete, today) === "atrasada");
  const dueToday = open.filter((l) => dueState(l.data_lembrete, today) === "hoje");
  const inCadence = open.filter((l) => l.cadencia_status === "ativa");
  const meetingsSoon = open.filter(
    (l) => l.etapa === "reuniao" && l.reuniao_em && l.reuniao_em.slice(0, 10) <= weekEnd,
  );
  const agenda = [...overdue, ...dueToday].sort((a, b) =>
    (a.data_lembrete ?? "").localeCompare(b.data_lembrete ?? ""),
  );

  const openLead = (l: Lead) => navigate({ to: "/leads/$id", params: { id: l.id } });

  function handleMove(lead: Lead, columnKey: string) {
    const col = BOARD_COLUMNS.find((c) => c.key === columnKey);
    if (!col || col.stages.includes(lead.etapa as LeadStage)) return;
    const target = col.stages[0];
    if (isFinalStage(target)) {
      setClosing({ lead, resultado: columnKey === "ganho" ? "ganho" : "perdido" });
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
      apply.mutate({
        id: lead.id,
        change: startCadence(lead, {
          userId: user.id,
          now: new Date(),
          waits: waitsFrom(templates),
        }),
        success: `Cadência iniciada para ${lead.nome}`,
      });
      return;
    }
    apply.mutate({
      id: lead.id,
      change: moveToStage(target),
      success: `${lead.nome} → ${STAGE_META[target].label}`,
    });
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
      <header className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Acompanhamento de Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Processo comercial TO BE: da primeira ligação ao contrato."
              : "Leads atribuídos a você no processo comercial."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="gap-2" onClick={() => setTemplatesOpen(true)}>
            <MessagesSquare className="size-4" /> Modelos
          </Button>
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Cadastrar lead
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            disabled={!k.key}
            onClick={() => k.key && setAction(action === k.key ? "todas" : k.key)}
            className={cn(
              "rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4 text-left backdrop-blur-xl transition disabled:cursor-default",
              k.key && "hover:border-primary/40",
              k.key && action === k.key && "border-primary/60",
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

      {agenda.length > 0 && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
              Ações de hoje e atrasadas
            </p>
            <ul className="divide-y divide-border/40">
              {agenda.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => openLead(l)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left hover:text-primary"
                  >
                    <DueBadge date={l.data_lembrete} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{l.nome}</span>
                      {l.empresa ? (
                        <span className="text-muted-foreground"> · {l.empresa}</span>
                      ) : null}
                    </span>
                    <span className="w-full truncate text-xs text-muted-foreground sm:w-auto sm:max-w-[45%]">
                      {l.proximo_passo ?? "Definir próxima ação"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {agenda.length > 8 && (
              <Button
                variant="link"
                className="h-auto px-0 text-xs"
                onClick={() => setAction("hoje_atrasadas")}
              >
                Ver todas ({agenda.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa ou contato"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as etapas</SelectItem>
              <SelectItem value="ativas">Em andamento</SelectItem>
              <SelectItem value="encerradas">Encerradas</SelectItem>
              {[...ACTIVE_STAGES, ...FINAL_STAGES].map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                <SelectItem value="sem">Sem responsável</SelectItem>
                {commercialPeople.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={action} onValueChange={(v) => setAction(v as ActionFilter)}>
            <SelectTrigger className="lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as próximas ações</SelectItem>
              <SelectItem value="hoje_atrasadas">Hoje e atrasadas</SelectItem>
              <SelectItem value="atrasadas">Atrasadas</SelectItem>
              <SelectItem value="hoje">Para hoje</SelectItem>
              <SelectItem value="semana">Próximos 7 dias</SelectItem>
              <SelectItem value="sem_acao">Sem próxima ação</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-input p-0.5">
            <Button
              size="sm"
              variant={view === "kanban" ? "secondary" : "ghost"}
              className="h-8 flex-1 gap-1.5"
              onClick={() => setView("kanban")}
            >
              <Columns3 className="size-4" /> Kanban
            </Button>
            <Button
              size="sm"
              variant={view === "lista" ? "secondary" : "ghost"}
              className="h-8 flex-1 gap-1.5"
              onClick={() => setView("lista")}
            >
              <List className="size-4" /> Lista
            </Button>
          </div>
        </div>
      </div>

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
      ) : view === "kanban" ? (
        <>
          <p className="hidden text-xs text-muted-foreground md:block">
            Arraste os cartões entre as colunas. Etapas com regras próprias (cadência, reunião,
            encerramento) pedem os dados necessários antes de mover.
          </p>
          <LeadBoard leads={filtered} people={people} onOpen={openLead} onMove={handleMove} />
        </>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum lead encontrado com esses filtros.
        </p>
      ) : (
        <LeadList leads={filtered} people={people} onOpen={openLead} />
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={null}
        userId={user.id}
        isAdmin={isAdmin}
      />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} canEdit={isAdmin} />
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
