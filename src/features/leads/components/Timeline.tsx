import { useMemo } from "react";
import {
  ArrowRightLeft,
  CalendarCheck2,
  Flag,
  Gavel,
  Mail,
  MessageCircle,
  MessageSquareReply,
  Phone,
  Settings2,
  StickyNote,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePeopleMap } from "../api";
import { channelLabel, stageLabel, type LeadActivity } from "../model";
import { PersonChip, SectionCard } from "./shared";
import { formatDateTime, isOverdue } from "../format";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ligacao: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  resposta: MessageSquareReply,
  reuniao: CalendarCheck2,
  marco: Target,
  decisao: Gavel,
  mudanca_etapa: ArrowRightLeft,
  nota: StickyNote,
  sistema: Settings2,
  encerramento: Flag,
};

function when(a: LeadActivity) {
  return a.realizado_em ?? a.previsto_para ?? a.created_at;
}

export function Timeline({ activities }: { activities: LeadActivity[] }) {
  const { data: people = {} } = usePeopleMap(activities.map((a) => a.responsavel_id));
  const planned = useMemo(
    () =>
      activities
        .filter((a) => a.status === "prevista")
        .sort((a, b) => (a.previsto_para ?? "").localeCompare(b.previsto_para ?? "")),
    [activities],
  );
  const history = useMemo(
    () =>
      activities
        .filter((a) => a.status !== "prevista")
        .sort((a, b) => when(b).localeCompare(when(a))),
    [activities],
  );

  return (
    // Recolhido por padrão: a "Próxima ação" já mostra o que fazer agora.
    <SectionCard
      title="Histórico de movimentações"
      collapsible
      defaultOpen={false}
      summary={
        history.length
          ? `${history.length} movimentaç${history.length === 1 ? "ão" : "ões"} · última em ${formatDateTime(when(history[0]))}`
          : "Nenhuma movimentação ainda"
      }
    >
      {planned.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Próximas</p>
          <ul className="space-y-1.5">
            {planned.map((a) => {
              const Icon = ICONS[a.tipo] ?? StickyNote;
              const late = isOverdue(a.previsto_para);
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.titulo}</p>
                    <p className={cn("text-[11px] text-muted-foreground", late && "text-red-400")}>
                      {formatDateTime(a.previsto_para)}
                      {late && " · atrasado"}
                    </p>
                  </div>
                  <PersonChip
                    person={a.responsavel_id ? people[a.responsavel_id] : null}
                    fallback="—"
                    className="hidden sm:inline-flex"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {history.map((a) => {
            const Icon = ICONS[a.tipo] ?? StickyNote;
            const cancelled = a.status === "cancelada";
            return (
              <li key={a.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[29px] grid size-6 place-items-center rounded-full border border-border bg-card",
                    cancelled && "opacity-60",
                  )}
                >
                  <Icon className="size-3.5 text-muted-foreground" />
                </span>
                <div className={cn("min-w-0", cancelled && "opacity-60")}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className={cn("text-sm font-medium", cancelled && "line-through")}>
                      {a.tipo === "mudanca_etapa" && a.etapa_para
                        ? `${a.titulo}: ${a.etapa_de ? `${stageLabel(a.etapa_de)} → ` : ""}${stageLabel(a.etapa_para)}`
                        : a.titulo}
                    </p>
                    {cancelled && <span className="text-xs text-muted-foreground">Cancelada</span>}
                  </div>
                  {a.resultado && (
                    <p className="text-xs text-foreground/80">Resultado: {a.resultado}</p>
                  )}
                  {a.observacoes && (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {a.observacoes}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      {cancelled
                        ? `Era previsto para ${formatDateTime(a.previsto_para)}`
                        : formatDateTime(a.realizado_em ?? a.created_at)}
                    </span>
                    {a.canal && <span>via {channelLabel(a.canal)}</span>}
                    {a.responsavel_id && (
                      <PersonChip person={people[a.responsavel_id]} fallback="—" />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
