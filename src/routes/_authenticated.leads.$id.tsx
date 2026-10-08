import {
  createFileRoute,
  Link,
  redirect,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenText,
  Building2,
  Flag,
  ListChecks,
  Loader2,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  Phone,
  RotateCcw,
  ShieldQuestion,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  leadKeys,
  useLead,
  useLeadActivities,
  usePeopleMap,
  useTemplates,
} from "@/features/leads/api";
import { CadencePanel } from "@/features/leads/components/CadencePanel";
import {
  CallDialog,
  NextActionDialog,
  NoteDialog,
  ResponseDialog,
} from "@/features/leads/components/ContactDialogs";
import { ConfirmDialog } from "@/features/leads/components/dialog-kit";
import { LeadFormDialog } from "@/features/leads/components/LeadFormDialog";
import { ProcessPanel } from "@/features/leads/components/ProcessPanel";
import { CloseLeadDialog, ReopenDialog } from "@/features/leads/components/ProcessDialogs";
import { CallScriptSheet, ObjectionsSheet } from "@/features/leads/components/ScriptAndTemplates";
import { Timeline } from "@/features/leads/components/Timeline";
import {
  DueBadge,
  OwnerChip,
  PersonChip,
  SectionCard,
  StageBadge,
} from "@/features/leads/components/shared";
import { formatDate, formatDateTime, formatMoney } from "@/features/leads/format";
import {
  ACTIVE_STAGES,
  STAGE_META,
  callResultLabel,
  canalLabel,
  isFinalStage,
  senderVars,
  stageLabel,
  type LeadStage,
} from "@/features/leads/model";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: LeadDetailPage,
});

type DialogKind =
  | "edit"
  | "call"
  | "response"
  | "note"
  | "next"
  | "close"
  | "reopen"
  | "script"
  | "objections"
  | null;

function LeadDetailPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: lead, isLoading } = useLead(id);
  const { data: activities = [] } = useLeadActivities(id);
  const { data: templates = [] } = useTemplates();
  const { data: people = {} } = usePeopleMap([
    lead?.responsavel_id,
    lead?.proxima_acao_responsavel_id,
  ]);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const { data: client } = useQuery({
    queryKey: ["leads", "client", lead?.client_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, nome")
        .eq("id", lead!.client_id!)
        .maybeSingle();
      return data;
    },
    enabled: !!lead?.client_id,
  });

  // Quem assina é o responsável pelo lead: a mensagem sai do número dele.
  const vars = useMemo(
    () => ({
      nome: lead?.nome,
      empresa: lead?.empresa,
      ...(lead ? senderVars(lead, people) : {}),
      origem: lead?.origem || canalLabel(lead?.canal_origem),
    }),
    [lead, people],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!lead) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Lead não encontrado ou sem permissão de acesso.
        </p>
        <Button asChild variant="secondary">
          <Link to="/leads">Voltar para Acompanhamento de Leads</Link>
        </Button>
      </div>
    );
  }

  const closed = isFinalStage(lead.etapa);
  const pendingCallback =
    activities.find((a) => a.status === "prevista" && a.chave === "retorno_ligacao")?.id ?? null;
  const stageIdx = ACTIVE_STAGES.indexOf(lead.etapa as LeadStage);
  const set = (k: DialogKind) => (v: boolean) => setDialog(v ? k : null);

  async function remove() {
    if (!lead) return;
    setDeleting(true);
    const { error } = await supabase.from("partner_leads").delete().eq("id", lead.id);
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível excluir", { description: error.message });
      return;
    }
    setConfirmDelete(false);
    toast.success("Lead excluído");
    qc.invalidateQueries({ queryKey: leadKeys.all });
    navigate({ to: "/leads" });
  }

  const telDigits = (lead.telefone ?? "").replace(/\D/g, "");

  return (
    <div className="space-y-5">
      <div>
        {/* Volta para onde a pessoa estava (Agenda, Cadência, Banco…); sem histórico, Kanban. */}
        {canGoBack ? (
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Voltar
          </button>
        ) : (
          <Link
            to="/leads"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Kanban de leads
          </Link>
        )}
      </div>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {lead.nome}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {lead.empresa && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" /> {lead.empresa}
              </span>
            )}
            <StageBadge etapa={lead.etapa} subetapa={lead.subetapa} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!closed && (
            <>
              <Button size="sm" className="gap-1.5" onClick={() => setDialog("call")}>
                <Phone className="size-4" /> Registrar ligação
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => setDialog("response")}
              >
                <MessageSquareReply className="size-4" /> Lead respondeu
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setDialog("script")}
          >
            <BookOpenText className="size-4" /> Roteiro
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setDialog("objections")}
          >
            <ShieldQuestion className="size-4" /> Objeções
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Mais ações">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog("edit")}>
                <Pencil className="mr-2 size-4" /> Editar dados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("note")}>
                <StickyNote className="mr-2 size-4" /> Registrar atividade
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {closed ? (
                <DropdownMenuItem onClick={() => setDialog("reopen")}>
                  <RotateCcw className="mr-2 size-4" /> Reabrir lead
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setDialog("close")}>
                  <Flag className="mr-2 size-4" /> Encerrar lead
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 size-4" /> Excluir lead
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Progresso no processo */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ol className="flex min-w-max gap-1.5">
          {ACTIVE_STAGES.map((s, i) => (
            <li
              key={s}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                i < stageIdx && "border-primary/30 text-muted-foreground",
                i === stageIdx && "border-primary bg-primary/15 font-medium text-primary",
                (i > stageIdx || closed) &&
                  i !== stageIdx &&
                  "border-border/50 text-muted-foreground/60",
              )}
            >
              <span className={cn("size-1.5 rounded-full", STAGE_META[s].dot)} />
              {STAGE_META[s].label}
            </li>
          ))}
          {closed && (
            <li className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary">
              <span
                className={cn("size-1.5 rounded-full", STAGE_META[lead.etapa as LeadStage]?.dot)}
              />
              {stageLabel(lead.etapa)}
            </li>
          )}
        </ol>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        {/* No celular, "contents" deixa os blocos na ordem: dados, próxima ação, linha do tempo, cadência, diagnóstico. */}
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <SectionCard
            className="order-1"
            title="Dados do lead"
            icon={UserRound}
            action={
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setDialog("edit")}
              >
                <Pencil className="size-3.5" /> Editar
              </Button>
            }
          >
            <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              <Info label="Telefone / WhatsApp">
                {lead.telefone ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <a className="hover:text-primary" href={`tel:${telDigits}`}>
                      {lead.telefone}
                    </a>
                  </span>
                ) : (
                  "—"
                )}
              </Info>
              <Info label="Contato">{lead.contato ?? "—"}</Info>
              <Info label="Empresa">{lead.empresa ?? "—"}</Info>
              <Info label="Origem">
                {[canalLabel(lead.canal_origem), lead.origem].filter(Boolean).join(" · ") || "—"}
              </Info>
              <Info label="Responsável comercial">
                <OwnerChip lead={lead} people={people} className="text-sm" />
              </Info>
              <Info label="Valor estimado">{formatMoney(lead.valor_estimado)}</Info>
              <Info label="Primeiro contato">
                {lead.data_primeiro_contato
                  ? `${formatDateTime(lead.data_primeiro_contato)} · ${callResultLabel(lead.resultado_primeira_ligacao)}`
                  : "Ainda não houve ligação"}
              </Info>
              <Info label="Cadastrado em">{formatDate(lead.created_at)}</Info>
              <Info label="Necessidade percebida" wide>
                {lead.necessidade_inicial ?? "—"}
              </Info>
              {lead.observacoes && (
                <Info label="Observações" wide>
                  {lead.observacoes}
                </Info>
              )}
              {lead.client_id && (
                <Info label="Cliente vinculado" wide>
                  <Link to="/clientes" className="text-primary hover:underline">
                    {client?.nome ?? "Cliente"}
                  </Link>
                </Info>
              )}
              {lead.nao_contatar && (
                <p className="text-xs text-amber-400 sm:col-span-2">
                  Pediu para não receber novos contatos.
                </p>
              )}
              {lead.etapa_legada && (
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  Migrado do funil anterior (etapa “{lead.etapa_legada}”).
                </p>
              )}
            </dl>
          </SectionCard>

          <SectionCard
            className="order-2"
            title="Próxima ação"
            icon={ListChecks}
            action={
              !closed ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDialog("next")}
                >
                  <Pencil className="size-3.5" /> Ajustar
                </Button>
              ) : null
            }
          >
            {closed ? (
              <div className="space-y-2 text-sm">
                <p>
                  Lead encerrado como <span className="font-medium">{stageLabel(lead.etapa)}</span>
                  {lead.encerrado_em ? ` em ${formatDateTime(lead.encerrado_em)}` : ""}.
                </p>
                {lead.motivo_encerramento && (
                  <p className="text-muted-foreground">{lead.motivo_encerramento}</p>
                )}
                <Button size="sm" variant="secondary" onClick={() => setDialog("reopen")}>
                  <RotateCcw className="size-4" /> Reabrir
                </Button>
              </div>
            ) : lead.proximo_passo ? (
              <div className="space-y-2">
                <p className="text-base font-medium">{lead.proximo_passo}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <DueBadge date={lead.data_lembrete} />
                  <PersonChip
                    person={
                      people[lead.proxima_acao_responsavel_id ?? lead.responsavel_id ?? ""] ?? null
                    }
                    fallback="Responsável não definido"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Nenhuma próxima ação definida.</p>
                <Button size="sm" variant="secondary" onClick={() => setDialog("next")}>
                  Definir próxima ação
                </Button>
              </div>
            )}
          </SectionCard>

          <div className="order-4">
            <CadencePanel
              lead={lead}
              activities={activities}
              templates={templates}
              userId={user.id}
              vars={vars}
              onRespond={() => setDialog("response")}
            />
          </div>

          <div className="order-5">
            <ProcessPanel
              lead={lead}
              activities={activities}
              templates={templates}
              userId={user.id}
              vars={vars}
            />
          </div>
        </div>

        <div className="order-3 lg:sticky lg:top-4 lg:order-none">
          <Timeline activities={activities} />
        </div>
      </div>

      <ConfirmDialog
        request={
          confirmDelete
            ? {
                title: `Excluir o lead “${lead.nome}”?`,
                description:
                  "O lead e todo o histórico serão apagados. Esta ação não pode ser desfeita.",
                label: "Excluir",
                destructive: true,
                onConfirm: remove,
              }
            : null
        }
        onClose={() => setConfirmDelete(false)}
        pending={deleting}
      />
      <LeadFormDialog
        open={dialog === "edit"}
        onOpenChange={set("edit")}
        lead={lead}
        userId={user.id}
        isAdmin={isAdmin}
      />
      <CallDialog
        lead={lead}
        userId={user.id}
        open={dialog === "call"}
        onOpenChange={set("call")}
        pendingCallbackId={pendingCallback}
      />
      <ResponseDialog
        lead={lead}
        userId={user.id}
        open={dialog === "response"}
        onOpenChange={set("response")}
      />
      <NoteDialog
        lead={lead}
        userId={user.id}
        open={dialog === "note"}
        onOpenChange={set("note")}
      />
      <NextActionDialog
        lead={lead}
        userId={user.id}
        isAdmin={isAdmin}
        open={dialog === "next"}
        onOpenChange={set("next")}
      />
      <CloseLeadDialog
        lead={lead}
        userId={user.id}
        open={dialog === "close"}
        onOpenChange={set("close")}
      />
      <ReopenDialog
        lead={lead}
        userId={user.id}
        open={dialog === "reopen"}
        onOpenChange={set("reopen")}
      />
      <CallScriptSheet open={dialog === "script"} onOpenChange={set("script")} />
      <ObjectionsSheet open={dialog === "objections"} onOpenChange={set("objections")} />
    </div>
  );
}

function Info({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}
