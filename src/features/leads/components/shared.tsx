import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Person } from "../api";
import { initialsOf, todayStr } from "../format";
import { STAGE_META, SUBSTEP_LABEL, dueState, type Lead, type LeadStage } from "../model";

export function PersonChip({
  person,
  fallback = "Sem responsável",
  className,
}: {
  person?: Person | null;
  fallback?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={person?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary/20 text-[9px] font-semibold text-primary">
          {initialsOf(person?.nome ?? person?.email)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{person?.nome ?? person?.email ?? fallback}</span>
    </span>
  );
}

/** Responsável pelo lead: pessoa do sistema ou "Outro" (nome digitado). */
export function OwnerChip({
  lead,
  people,
  className,
}: {
  lead: Pick<Lead, "responsavel_id" | "responsavel_externo">;
  people: Record<string, Person>;
  className?: string;
}) {
  if (!lead.responsavel_id && lead.responsavel_externo)
    return (
      <PersonChip
        person={{ id: "", nome: lead.responsavel_externo, email: null, avatar_url: null }}
        className={className}
      />
    );
  return (
    <PersonChip
      person={lead.responsavel_id ? people[lead.responsavel_id] : null}
      className={className}
    />
  );
}

export function StageBadge({ etapa, subetapa }: { etapa: string; subetapa?: string | null }) {
  const meta = STAGE_META[etapa as LeadStage];
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium">
      <span className={cn("size-1.5 shrink-0 rounded-full", meta?.dot ?? "bg-muted-foreground")} />
      <span className="truncate">
        {meta?.label ?? etapa}
        {subetapa && SUBSTEP_LABEL[subetapa] ? ` · ${SUBSTEP_LABEL[subetapa]}` : ""}
      </span>
    </span>
  );
}

export function DueBadge({
  date,
  className,
}: {
  date: string | null | undefined;
  className?: string;
}) {
  const state = dueState(date, todayStr());
  if (state === "sem_data") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] text-muted-foreground/70",
          className,
        )}
      >
        <CalendarClock className="size-3" /> Sem data
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        state === "atrasada" && "border-red-500/50 bg-red-500/10 text-red-400",
        state === "hoje" && "border-amber-500/50 bg-amber-500/10 text-amber-400",
        state === "futura" && "border-border text-muted-foreground",
        className,
      )}
    >
      <CalendarClock className="size-3" />
      {state === "hoje" ? "Hoje" : format(parseISO(date!), "dd/MM")}
      {state === "atrasada" && " · atrasada"}
    </span>
  );
}

/**
 * Bloco de uma página. Com `collapsible`, começa fechado ou aberto conforme `defaultOpen`
 * e mostra `summary` (uma linha) enquanto está fechado, para a tela não ficar poluída.
 */
export function SectionCard({
  title,
  action,
  children,
  className,
  collapsible,
  defaultOpen = true,
  summary,
}: {
  title: string;
  /** Mantido por compatibilidade; o ícone não é mais exibido. */
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  summary?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const aberto = !collapsible || open;
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      <header className={cn("flex items-center justify-between gap-2", aberto && "mb-3")}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {!open && summary && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
            )}
            <ChevronDown
              className={cn(
                "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        ) : (
          <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
        )}
        {action}
      </header>
      {aberto && children}
    </section>
  );
}
