import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { subDays } from "date-fns";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useApplyLeadChange,
  useLeads,
  usePendingActivities,
  usePeopleMap,
  useTemplates,
} from "@/features/leads/api";
import {
  CADENCE_LABEL,
  cadenceResponse,
  CLOSE_CADENCE_KEY,
  DEFAULT_WAIT_DAYS,
  isCadenceKey,
  waitsFrom,
  type CadenceKey,
} from "@/features/leads/cadence";
import { CadenceBoard, type CadenceRow } from "@/features/leads/components/CadenceBoard";
import { SendTemplateDialog } from "@/features/leads/components/CadencePanel";
import { ResponseDialog } from "@/features/leads/components/ContactDialogs";
import { ConfirmDialog, type ConfirmRequest } from "@/features/leads/components/dialog-kit";
import { PageHeader } from "@/features/leads/components/LeadFilters";
import { isOverdue } from "@/features/leads/format";
import { canalLabel, senderVars, type Lead } from "@/features/leads/model";
import { useWhatsappStatus } from "@/features/leads/whatsapp";
import {
  closeCadenceWithoutResponse,
  closeLead,
  registerTemplateSent,
} from "@/features/leads/workflow";

export const Route = createFileRoute("/_authenticated/leads/cadencia")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: CadenciaPage,
});

const EARLY_STAGES = ["primeiro_contato", "cadencia", "reuniao"];

function WhatsappBadge({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useWhatsappStatus();
  const instances = data?.instances ?? [];
  const { data: names = {} } = usePeopleMap(instances.map((i) => i.user_id));
  const box =
    "inline-flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-xs";
  const dot = (on: boolean) => cn("size-2 rounded-full", on ? "bg-emerald-400" : "bg-red-400");

  if (isLoading)
    return (
      <span className={box}>
        <span className="size-2 rounded-full bg-muted-foreground" /> Verificando WhatsApp…
      </span>
    );
  if (!data?.configured || instances.length === 0)
    return (
      <span
        className={box}
        title={
          isAdmin
            ? !data?.configured
              ? "Cadastre EVOLUTION_API_URL e EVOLUTION_API_KEY nos segredos do projeto (Lovable Cloud)."
              : "Cadastre a instância de cada pessoa em Equipe → ⋯ → WhatsApp (Evolution)."
            : undefined
        }
      >
        <span className="size-2 rounded-full bg-zinc-500" />
        {!data?.configured ? "WhatsApp não configurado" : "Nenhum número cadastrado"}
      </span>
    );
  return (
    <span className={box}>
      {instances.map((i) => {
        const nome = i.user_id
          ? (names[i.user_id]?.nome?.trim().split(/\s+/)[0] ?? i.instance)
          : "Padrão";
        return (
          <span
            key={i.instance}
            className="inline-flex items-center gap-1.5"
            title={`Instância ${i.instance}: ${i.connected ? "conectada" : "desconectada"}`}
          >
            <span className={dot(i.connected)} />
            {nome}
          </span>
        );
      })}
    </span>
  );
}

function CadenciaPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const { data: leads = [], isLoading } = useLeads();
  const { data: pending = [] } = usePendingActivities();
  const { data: templates = [] } = useTemplates();
  const { data: people = {} } = usePeopleMap(leads.map((l) => l.responsavel_id));
  const apply = useApplyLeadChange(null);
  const [sending, setSending] = useState<CadenceRow | null>(null);
  const [responding, setResponding] = useState<Lead | null>(null);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const waits = { ...DEFAULT_WAIT_DAYS, ...waitsFrom(templates) } as Record<CadenceKey, number>;

  const rows = useMemo<CadenceRow[]>(() => {
    return leads
      .filter((l) => l.cadencia_status === "ativa")
      .map((lead) => {
        const p = pending.find(
          (a) => a.lead_id === lead.id && (isCadenceKey(a.chave) || a.chave === CLOSE_CADENCE_KEY),
        );
        const step = (p?.chave ?? lead.subetapa ?? "template_1") as CadenceRow["step"];
        return { lead, step, pendingId: p?.id ?? null, due: p?.previsto_para ?? null };
      })
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  }, [leads, pending]);

  const since = subDays(new Date(), 30).toISOString();
  const responded = leads.filter(
    (l) => l.cadencia_status === "respondida" && EARLY_STAGES.includes(l.etapa),
  );
  const noAnswer = leads.filter(
    (l) => l.etapa === "sem_resposta" && (l.encerrado_em ?? l.updated_at) >= since,
  );
  const cadence = cadenceResponse(leads);
  const lateCount = rows.filter((r) => isOverdue(r.due)).length;

  // Memorizado: o diálogo reinicia o texto quando as variáveis mudam.
  const sendingVars = useMemo(
    () =>
      sending
        ? {
            nome: sending.lead.nome,
            empresa: sending.lead.empresa,
            ...senderVars(sending.lead, people),
            origem: sending.lead.origem || canalLabel(sending.lead.canal_origem),
          }
        : {},
    [sending, people],
  );

  function closeNoAnswer(row: CadenceRow) {
    const atEnd = row.step === CLOSE_CADENCE_KEY;
    const ctx = { userId: user.id, now: new Date() };
    setConfirming({
      title: `Encerrar ${row.lead.nome} como “Sem resposta”?`,
      description: atEnd
        ? "O break-up foi enviado e o lead não respondeu. O histórico fica preservado."
        : "O lead ainda não recebeu o break-up. As mensagens previstas serão canceladas.",
      label: "Encerrar",
      onConfirm: () =>
        apply.mutate(
          {
            id: row.lead.id,
            change: atEnd
              ? closeCadenceWithoutResponse(row.lead, row.pendingId, ctx)
              : closeLead(
                  row.lead,
                  {
                    resultado: "sem_resposta",
                    motivo: "Encerrado sem resposta antes do fim da cadência",
                  },
                  ctx,
                ),
            success: "Lead encerrado como sem resposta",
          },
          { onSuccess: () => setConfirming(null) },
        ),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Fluxo de Cadência"
        description="Envie cada template pelo WhatsApp da DPlay com um clique. O próximo passo é lembrado em dias úteis; nada é enviado sem você clicar."
        actions={
          <>
            <WhatsappBadge isAdmin={isAdmin} />
            <Button variant="secondary" asChild>
              <Link to="/ferramentas/templates">Editar templates</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Em cadência", value: rows.length },
          { label: "Envios atrasados", value: lateCount, tone: lateCount ? "text-red-400" : "" },
          {
            label: "Responderam (total)",
            value: cadence.answered,
            hint: "Desde o início, inclui quem pediu para sair",
          },
          { label: "Taxa de resposta", value: cadence.rate, hint: cadence.hint },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4"
          >
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{k.label}</p>
            <p className={cn("mt-2 text-2xl font-semibold", k.tone)}>{k.value}</p>
            {k.hint && <p className="text-[11px] text-muted-foreground">{k.hint}</p>}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length + responded.length + noAnswer.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 py-14 text-center">
          <MessageCircle className="mx-auto size-6 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum lead em cadência. Ela começa quando o lead não atende a ligação.
          </p>
        </div>
      ) : (
        <>
          <p className="hidden text-xs text-muted-foreground md:block">
            Os cartões avançam quando a mensagem é enviada. Use “Respondeu” ou “Encerrar” no cartão
            (ou arraste para as colunas) para registrar o desfecho.
          </p>
          <CadenceBoard
            rows={rows}
            responded={responded}
            noAnswer={noAnswer}
            people={people}
            waits={waits}
            onSend={setSending}
            onRespond={setResponding}
            onClose={closeNoAnswer}
          />
        </>
      )}

      {sending && isCadenceKey(sending.step) && (
        <SendTemplateDialog
          lead={sending.lead}
          open={!!sending}
          onOpenChange={(v) => !v && setSending(null)}
          template={templates.find((t) => t.chave === sending.step)}
          title={`Enviar ${CADENCE_LABEL[sending.step]} — ${sending.lead.nome}`}
          vars={sendingVars}
          pendingActivityId={sending.pendingId}
          build={(input) =>
            registerTemplateSent(
              sending.lead,
              sending.step as CadenceKey,
              sending.pendingId,
              input,
              {
                userId: user.id,
                now: new Date(),
                waits: waitsFrom(templates),
              },
            )
          }
          success={`${CADENCE_LABEL[sending.step]} enviado`}
        />
      )}
      <ConfirmDialog
        request={confirming}
        onClose={() => setConfirming(null)}
        pending={apply.isPending}
      />
      {responding && (
        <ResponseDialog
          lead={responding}
          userId={user.id}
          open={!!responding}
          onOpenChange={(v) => !v && setResponding(null)}
        />
      )}
    </div>
  );
}
