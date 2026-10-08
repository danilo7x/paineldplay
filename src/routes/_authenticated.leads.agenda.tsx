import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { CalendarCheck2, Loader2, Presentation } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLeads, usePendingActivities, usePeopleMap } from "@/features/leads/api";
import { useLeadFilters } from "@/features/leads/filters";
import { LeadFiltersBar, PageHeader } from "@/features/leads/components/LeadFilters";
import { DueBadge, OwnerChip, PersonChip, StageBadge } from "@/features/leads/components/shared";
import { formatDateTime, todayStr } from "@/features/leads/format";
import { dueState, isFinalStage, type Lead } from "@/features/leads/model";

export const Route = createFileRoute("/_authenticated/leads/agenda")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: AgendaPage,
});

function AgendaPage() {
  const { isAdmin } = Route.useRouteContext();
  const { data: leads = [], isLoading } = useLeads();
  const { data: pending = [] } = usePendingActivities();
  const { data: people = {} } = usePeopleMap(
    leads.map((l) => l.proxima_acao_responsavel_id ?? l.responsavel_id),
  );
  // O filtro de responsável segue o dono da próxima ação, o mesmo exibido na linha.
  const { filters, set, filtered } = useLeadFilters(leads, {}, { byNextActionOwner: true });

  const today = todayStr();
  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const open = filtered.filter((l) => !isFinalStage(l.etapa));
  const byDate = (a: Lead, b: Lead) => (a.data_lembrete ?? "").localeCompare(b.data_lembrete ?? "");
  const groups = [
    {
      key: "atrasadas",
      title: "Atrasadas",
      tone: "text-red-400",
      items: open.filter((l) => dueState(l.data_lembrete, today) === "atrasada").sort(byDate),
    },
    {
      key: "hoje",
      title: "Para hoje",
      tone: "text-amber-400",
      items: open.filter((l) => dueState(l.data_lembrete, today) === "hoje"),
    },
    {
      key: "semana",
      title: "Próximos 7 dias",
      tone: "",
      items: open
        .filter((l) => l.data_lembrete && l.data_lembrete > today && l.data_lembrete <= weekEnd)
        .sort(byDate),
    },
    {
      key: "sem",
      title: "Sem data definida",
      tone: "text-muted-foreground",
      items: open.filter((l) => !l.data_lembrete),
    },
  ];

  const leadById = useMemo(() => new Map(filtered.map((l) => [l.id, l])), [filtered]);
  const meetings = pending
    .filter((a) => a.tipo === "reuniao" && leadById.has(a.lead_id))
    .map((a) => ({ ...a, lead: leadById.get(a.lead_id)! }));
  const nowIso = new Date().toISOString();

  return (
    <div className="space-y-6">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Agenda Comercial"
        description="Próximas ações, reuniões de diagnóstico e apresentações de proposta."
      />

      <LeadFiltersBar filters={filters} set={set} isAdmin={isAdmin} showAction={false} activeOnly />

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <div className="space-y-5">
            {groups.map((g) =>
              g.items.length === 0 ? null : (
                <section key={g.key}>
                  <h2
                    className={cn("mb-2 text-xs font-semibold uppercase tracking-widest", g.tone)}
                  >
                    {g.title} · {g.items.length}
                  </h2>
                  <ul className="overflow-hidden rounded-2xl border border-border/50 bg-card/50">
                    {g.items.map((l) => (
                      <li key={l.id} className="border-b border-border/40 last:border-0">
                        <Link
                          to="/leads/$id"
                          params={{ id: l.id }}
                          className="grid gap-2 px-4 py-3 transition hover:bg-accent/40 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center"
                        >
                          <DueBadge date={l.data_lembrete} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{l.nome}</span>
                            <StageBadge etapa={l.etapa} subetapa={l.subetapa} />
                          </span>
                          <span className="min-w-0 truncate text-sm text-muted-foreground">
                            {l.proximo_passo ?? "Definir próxima ação"}
                          </span>
                          {l.proxima_acao_responsavel_id ? (
                            <PersonChip person={people[l.proxima_acao_responsavel_id] ?? null} />
                          ) : (
                            <OwnerChip lead={l} people={people} />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}
            {groups.every((g) => g.items.length === 0) && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma ação pendente. 🎉
              </p>
            )}
          </div>

          <section className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck2 className="size-4 text-primary" /> Reuniões e apresentações
            </h2>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada agendado.</p>
            ) : (
              <ul className="space-y-2">
                {meetings.map((m) => {
                  const past = (m.previsto_para ?? "") < nowIso;
                  const Icon = m.chave === "apresentacao_proposta" ? Presentation : CalendarCheck2;
                  return (
                    <li key={m.id}>
                      <Link
                        to="/leads/$id"
                        params={{ id: m.lead.id }}
                        className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-background/40 p-3 transition hover:border-primary/40"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {formatDateTime(m.previsto_para)}
                          </span>
                          <span className="block truncate text-xs">
                            {m.titulo} · {m.lead.nome}
                          </span>
                          {past && (
                            <span className="text-[11px] text-red-400">
                              Já passou — registre o resultado
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
