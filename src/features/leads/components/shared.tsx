import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Person } from "../api";
import { initialsOf, todayStr } from "../format";
import { STAGE_META, SUBSTEP_LABEL, dueState, type LeadStage } from "../model";

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

export function StageBadge({ etapa, subetapa }: { etapa: string; subetapa?: string | null }) {
  const meta = STAGE_META[etapa as LeadStage];
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium">
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
        state === "futura" && "border-border/60 text-muted-foreground",
        className,
      )}
    >
      <CalendarClock className="size-3" />
      {state === "hoje" ? "Hoje" : format(parseISO(date!), "dd/MM")}
      {state === "atrasada" && " · atrasada"}
    </span>
  );
}

export function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4 backdrop-blur-xl sm:p-5",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
