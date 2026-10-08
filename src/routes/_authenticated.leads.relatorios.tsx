import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeads, usePeopleMap } from "@/features/leads/api";
import { cadenceResponse } from "@/features/leads/cadence";
import { PageHeader } from "@/features/leads/components/LeadFilters";
import { formatMoney } from "@/features/leads/format";
import {
  ACTIVE_STAGES,
  FINAL_STAGES,
  STAGE_META,
  canalLabel,
  isFinalStage,
  ownerName,
  type Lead,
} from "@/features/leads/model";

export const Route = createFileRoute("/_authenticated/leads/relatorios")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: RelatoriosPage,
});

type Period = "30" | "90" | "365" | "todos";

const PERIOD_LABEL: Record<Period, string> = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  "365": "Últimos 12 meses",
  todos: "Todo o período",
};

type Bar = { label: string; value: number; hint?: string };

/** Barras horizontais de um único tom, com o valor escrito ao lado (sem legenda por cor). */
function BarList({ title, bars, empty }: { title: string; bars: Bar[]; empty?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <section className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {bars.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty ?? "Sem dados no período."}</p>
      ) : (
        <ul className="space-y-2.5">
          {bars.map((b) => (
            <li key={b.label} title={`${b.label}: ${b.value}${b.hint ? ` · ${b.hint}` : ""}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-foreground/90">{b.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {b.value}
                  {b.hint ? ` · ${b.hint}` : ""}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${b.value === 0 ? 0 : Math.max(2, (b.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "—";
}

function RelatoriosPage() {
  const { isAdmin } = Route.useRouteContext();
  const { data: all = [], isLoading } = useLeads();
  const { data: people = {} } = usePeopleMap(all.map((l) => l.responsavel_id));
  const [period, setPeriod] = useState<Period>("90");

  const leads = useMemo(() => {
    if (period === "todos") return all;
    const since = subDays(new Date(), Number(period)).toISOString();
    return all.filter((l) => l.created_at >= since);
  }, [all, period]);

  const won = leads.filter((l) => l.etapa === "ganho");
  const closed = leads.filter((l) => isFinalStage(l.etapa));
  const active = leads.filter((l) => !isFinalStage(l.etapa));
  const wonValue = won.reduce((s, l) => s + Number(l.valor_proposta ?? l.valor_estimado ?? 0), 0);
  const cycleDays = won
    .filter((l) => l.encerrado_em)
    .map((l) => differenceInCalendarDays(new Date(l.encerrado_em!), new Date(l.created_at)));
  const avgCycle = cycleDays.length
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : null;
  const cadence = cadenceResponse(leads);
  const meetingsHeld = leads.filter((l) => l.reuniao_status === "realizada").length;

  const funnel: Bar[] = [...ACTIVE_STAGES, ...FINAL_STAGES].map((s) => ({
    label: STAGE_META[s].label,
    value: leads.filter((l) => l.etapa === s).length,
  }));

  const groupBy = (key: (l: Lead) => string): Bar[] => {
    const map = new Map<string, { total: number; won: number }>();
    for (const l of leads) {
      const k = key(l);
      const cur = map.get(k) ?? { total: 0, won: 0 };
      cur.total++;
      if (l.etapa === "ganho") cur.won++;
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, value: v.total, hint: `${v.won} ganho(s)` }))
      .sort((a, b) => b.value - a.value);
  };

  const lossReasons: Bar[] = (() => {
    const map = new Map<string, number>();
    for (const l of leads.filter(
      (x) => x.etapa === "perdido" || x.etapa === "contrato_nao_concluido",
    )) {
      const k = l.motivo_encerramento?.trim() || "Motivo não informado";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Relatórios"
        description={
          isAdmin
            ? "Indicadores do processo comercial a partir dos leads cadastrados no período."
            : "Indicadores dos leads atribuídos a você, cadastrados no período."
        }
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Leads no período"
              value={leads.length}
              hint={`${active.length} em andamento`}
            />
            <Stat
              label="Ganhos"
              value={won.length}
              hint={wonValue ? `${formatMoney(wonValue)} em propostas` : undefined}
            />
            <Stat
              label="Taxa de conversão"
              value={pct(won.length, closed.length)}
              hint="ganhos ÷ encerrados"
            />
            <Stat
              label="Ciclo médio até o ganho"
              value={avgCycle == null ? "—" : `${avgCycle} dia${avgCycle === 1 ? "" : "s"}`}
            />
            <Stat label="Taxa de resposta" value={cadence.rate} hint={cadence.hint} />
            <Stat label="Diagnósticos realizados" value={meetingsHeld} />
            <Stat
              label="Sem resposta"
              value={leads.filter((l) => l.etapa === "sem_resposta").length}
            />
            <Stat
              label="Perdidos"
              value={
                leads.filter((l) => l.etapa === "perdido" || l.etapa === "contrato_nao_concluido")
                  .length
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarList title="Funil por etapa" bars={funnel} />
            <BarList
              title="Origem dos leads"
              bars={groupBy((l) => canalLabel(l.canal_origem) ?? "Não informada")}
            />
            {isAdmin && (
              <BarList
                title="Por responsável"
                bars={groupBy((l) => ownerName(l, people) ?? "Sem responsável")}
              />
            )}
            <BarList
              title="Motivos de perda"
              bars={lossReasons}
              empty="Nenhum lead perdido no período."
            />
          </div>
        </>
      )}
    </div>
  );
}
