import { useState } from "react";
import { ArrowRightLeft, GripVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Person } from "../api";
import { BOARD_COLUMNS, dueState, isFinalStage, stageLabel, type Lead } from "../model";
import { DueBadge, PersonChip, StageBadge } from "./shared";
import { todayStr } from "../format";

export type MoveHandler = (lead: Lead, columnKey: string) => void;

export function LeadCard({
  lead,
  people,
  onOpen,
  onMove,
  draggable = true,
}: {
  lead: Lead;
  people: Record<string, Person>;
  onOpen: (lead: Lead) => void;
  onMove: MoveHandler;
  draggable?: boolean;
}) {
  const due = dueState(lead.data_lembrete, todayStr());
  const closed = isFinalStage(lead.etapa);
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lead-id", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead);
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-background/70 p-3 text-left transition hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !closed && due === "atrasada" && "border-red-500/40",
        !closed && due === "hoje" && "border-amber-500/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 hidden size-3.5 shrink-0 text-muted-foreground/40 md:block" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{lead.nome}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {lead.empresa ?? "Empresa não informada"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 md:opacity-0 md:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Mover para outra etapa"
            >
              <ArrowRightLeft className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // O menu fica num portal, mas os eventos ainda sobem até o cartão.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            {BOARD_COLUMNS.map((c) => (
              <DropdownMenuItem
                key={c.key}
                disabled={c.stages.includes(lead.etapa as never)}
                onClick={() => onMove(lead, c.key)}
              >
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2">
        <StageBadge etapa={lead.etapa} subetapa={lead.subetapa} />
      </div>
      {!closed && (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <DueBadge date={lead.data_lembrete} />
          </div>
          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {lead.proximo_passo ? `→ ${lead.proximo_passo}` : "Sem próxima ação definida"}
          </p>
        </div>
      )}
      {closed && lead.motivo_encerramento && (
        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
          {lead.motivo_encerramento}
        </p>
      )}
      <div className="mt-2">
        <PersonChip person={lead.responsavel_id ? people[lead.responsavel_id] : null} />
      </div>
    </div>
  );
}

export function LeadBoard({
  leads,
  people,
  onOpen,
  onMove,
}: {
  leads: Lead[];
  people: Record<string, Person>;
  onOpen: (lead: Lead) => void;
  onMove: MoveHandler;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
      {BOARD_COLUMNS.map((col) => {
        const items = leads.filter((l) => col.stages.includes(l.etapa as never));
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== col.key) setOver(col.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/lead-id");
              const lead = leads.find((l) => l.id === id);
              if (lead) onMove(lead, col.key);
            }}
            className={cn(
              "flex w-[85%] shrink-0 snap-start flex-col rounded-2xl border-2 bg-card/40 p-2 transition sm:w-72",
              col.border,
              over === col.key && "border-primary bg-primary/5",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </p>
              <Badge variant="secondary" className="text-[10px]">
                {items.length}
              </Badge>
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-2">
              {items.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground/60">
                  Arraste um lead para cá
                </p>
              )}
              {items.map((l) => (
                <LeadCard key={l.id} lead={l} people={people} onOpen={onOpen} onMove={onMove} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LIST_GROUPS: { key: string; label: string }[] = [
  { key: "atrasada", label: "Atrasadas" },
  { key: "hoje", label: "Para hoje" },
  { key: "futura", label: "Próximas" },
  { key: "sem_data", label: "Sem próxima ação" },
  { key: "encerrado", label: "Encerrados" },
];

export function LeadList({
  leads,
  people,
  onOpen,
}: {
  leads: Lead[];
  people: Record<string, Person>;
  onOpen: (lead: Lead) => void;
}) {
  const today = todayStr();
  const groupOf = (l: Lead) =>
    isFinalStage(l.etapa) ? "encerrado" : dueState(l.data_lembrete, today);
  const sorted = [...leads].sort((a, b) =>
    (a.data_lembrete ?? "9999").localeCompare(b.data_lembrete ?? "9999"),
  );
  return (
    <div className="space-y-5">
      {LIST_GROUPS.map((g) => {
        const items = sorted.filter((l) => groupOf(l) === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key}>
            <h3
              className={cn(
                "mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground",
                g.key === "atrasada" && "text-red-400",
                g.key === "hoje" && "text-amber-400",
              )}
            >
              {g.label} · {items.length}
            </h3>
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/50">
              {items.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onOpen(l)}
                  className="grid w-full gap-2 border-b border-border/40 px-4 py-3 text-left transition last:border-0 hover:bg-accent/40 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[l.empresa, l.contato ?? l.telefone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <StageBadge etapa={l.etapa} subetapa={l.subetapa} />
                  </div>
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {isFinalStage(l.etapa)
                      ? `${stageLabel(l.etapa)}${l.motivo_encerramento ? ` — ${l.motivo_encerramento}` : ""}`
                      : (l.proximo_passo ?? "Sem próxima ação")}
                  </p>
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <PersonChip person={l.responsavel_id ? people[l.responsavel_id] : null} />
                    {!isFinalStage(l.etapa) && <DueBadge date={l.data_lembrete} />}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
