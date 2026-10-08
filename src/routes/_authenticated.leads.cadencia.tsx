import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profile-context";
import {
  useApplyLeadChange,
  useLeads,
  usePendingActivities,
  usePeopleMap,
  useTemplates,
} from "@/features/leads/api";
import {
  CADENCE_KEYS,
  CADENCE_LABEL,
  CLOSE_CADENCE_KEY,
  DEFAULT_WAIT_DAYS,
  isCadenceKey,
  waitsFrom,
  type CadenceKey,
} from "@/features/leads/cadence";
import { SendTemplateDialog } from "@/features/leads/components/CadencePanel";
import { ResponseDialog } from "@/features/leads/components/ContactDialogs";
import { PageHeader } from "@/features/leads/components/LeadFilters";
import { PersonChip } from "@/features/leads/components/shared";
import { formatDateTime } from "@/features/leads/format";
import { canalLabel, type Lead } from "@/features/leads/model";
import { closeCadenceWithoutResponse, registerTemplateSent } from "@/features/leads/workflow";

export const Route = createFileRoute("/_authenticated/leads/cadencia")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: CadenciaPage,
});

type Row = {
  lead: Lead;
  step: CadenceKey | typeof CLOSE_CADENCE_KEY;
  pendingId: string | null;
  due: string | null;
};

const STEP_ORDER = [...CADENCE_KEYS, CLOSE_CADENCE_KEY] as const;
const stepLabel = (k: string) =>
  isCadenceKey(k) ? CADENCE_LABEL[k] : "Encerrar como “Sem resposta”";

function CadenciaPage() {
  const { user } = Route.useRouteContext();
  const { profile } = useProfile();
  const { data: leads = [], isLoading } = useLeads();
  const { data: pending = [] } = usePendingActivities();
  const { data: templates = [] } = useTemplates();
  const { data: people = {} } = usePeopleMap(leads.map((l) => l.responsavel_id));
  const apply = useApplyLeadChange(null);
  const [sending, setSending] = useState<Row | null>(null);
  const [responding, setResponding] = useState<Lead | null>(null);

  const waits = { ...DEFAULT_WAIT_DAYS, ...waitsFrom(templates) };
  const nowIso = new Date().toISOString();

  const rows = useMemo<Row[]>(() => {
    return leads
      .filter((l) => l.cadencia_status === "ativa")
      .map((lead) => {
        const p = pending.find(
          (a) => a.lead_id === lead.id && (isCadenceKey(a.chave) || a.chave === CLOSE_CADENCE_KEY),
        );
        const step = (p?.chave ?? lead.subetapa ?? "template_1") as Row["step"];
        return { lead, step, pendingId: p?.id ?? null, due: p?.previsto_para ?? null };
      })
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  }, [leads, pending]);

  const responded = leads.filter((l) => l.cadencia_status === "respondida").length;
  const noAnswer = leads.filter((l) => l.etapa === "sem_resposta").length;
  const started = leads.filter((l) => (l.cadencia_ciclo ?? 0) > 0).length;
  const lateCount = rows.filter((r) => r.due && r.due < nowIso).length;

  // Memorizado: o diálogo reinicia o texto quando as variáveis mudam.
  const sendingVars = useMemo(
    () =>
      sending
        ? {
            nome: sending.lead.nome,
            empresa: sending.lead.empresa,
            seuNome: profile?.nome,
            seuEmail: profile?.email ?? user.email,
            origem: sending.lead.origem || canalLabel(sending.lead.canal_origem),
          }
        : {},
    [sending, profile, user.email],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Fluxo de cadência"
        description="Mensagens de WhatsApp em andamento. Nada é enviado automaticamente: copie, envie e registre."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/ferramentas/templates">Editar templates</Link>
          </Button>
        }
      />

      {/* Sequência */}
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {STEP_ORDER.map((k, i) => (
          <li key={k} className="relative rounded-2xl border border-border/50 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Passo {i + 1}
            </p>
            <p className="mt-1 text-sm font-medium">{stepLabel(k)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isCadenceKey(k)
                ? `Sem resposta em ${waits[k]} dia(s) útil(eis) → ${i < CADENCE_KEYS.length - 1 ? "próximo template" : "encerrar"}`
                : "Sem nova mensagem; histórico preservado"}
            </p>
            <p className="mt-2 text-lg font-semibold">{rows.filter((r) => r.step === k).length}</p>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Em cadência", value: rows.length },
          { label: "Envios atrasados", value: lateCount, tone: lateCount ? "text-red-400" : "" },
          { label: "Responderam", value: responded },
          {
            label: "Taxa de resposta",
            value: started ? `${Math.round((responded / started) * 100)}%` : "—",
            hint: `${noAnswer} encerrado(s) sem resposta`,
          },
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
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 py-14 text-center">
          <MessageCircle className="mx-auto size-6 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum lead em cadência. Ela começa quando o lead não atende a ligação.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/50">
          {rows.map((r) => {
            const late = r.due && r.due < nowIso;
            return (
              <div
                key={r.lead.id}
                className="grid gap-3 border-b border-border/40 px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <Link
                    to="/leads/$id"
                    params={{ id: r.lead.id }}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {r.lead.nome}
                  </Link>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[r.lead.empresa, r.lead.telefone].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <PersonChip
                    person={r.lead.responsavel_id ? people[r.lead.responsavel_id] : null}
                    className="mt-1"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm">{stepLabel(r.step)}</p>
                  <p className={cn("text-[11px] text-muted-foreground", late && "text-red-400")}>
                    {r.due
                      ? `Previsto para ${formatDateTime(r.due)}${late ? " · atrasado" : ""}`
                      : "Sem data prevista"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.step === CLOSE_CADENCE_KEY ? (
                    <Button
                      size="sm"
                      disabled={apply.isPending}
                      onClick={() => {
                        if (!confirm(`Encerrar ${r.lead.nome} como “Sem resposta”?`)) return;
                        apply.mutate({
                          id: r.lead.id,
                          change: closeCadenceWithoutResponse(r.lead, r.pendingId, {
                            userId: user.id,
                            now: new Date(),
                          }),
                          success: "Lead encerrado como sem resposta",
                        });
                      }}
                    >
                      Encerrar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setSending(r)}>
                      Preparar mensagem
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setResponding(r.lead)}>
                    Respondeu
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/leads/$id" params={{ id: r.lead.id }} aria-label="Abrir lead">
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sending && isCadenceKey(sending.step) && (
        <SendTemplateDialog
          lead={sending.lead}
          open={!!sending}
          onOpenChange={(v) => !v && setSending(null)}
          template={templates.find((t) => t.chave === sending.step)}
          title={`Enviar ${CADENCE_LABEL[sending.step]} — ${sending.lead.nome}`}
          vars={sendingVars}
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
          success={`${CADENCE_LABEL[sending.step]} registrado como enviado`}
        />
      )}
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
