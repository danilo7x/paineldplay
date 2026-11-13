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
import { BOARD_COLUMNS, STAGE_META, dueState, isFinalStage, type Lead } from "../model";
import { DueBadge, OwnerChip, StageBadge } from "./shared";
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
        "group cursor-pointer overflow-hidden rounded-xl border border-border bg-background/70 p-3 text-left transition hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !closed && due === "atrasada" && "border-l-2 border-l-red-400/70",
        !closed && due === "hoje" && "border-l-2 border-l-amber-400/70",
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
      {/* A coluna já mostra a etapa; a etiqueta só aparece quando acrescenta algo. */}
      {(closed || lead.subetapa) && (
        <div className="mt-2">
          <StageBadge etapa={lead.etapa} subetapa={lead.subetapa} />
        </div>
      )}
      {!closed && (
        <div className="mt-2 space-y-1">
          {lead.data_lembrete && (
            <div className="flex flex-wrap items-center gap-1.5">
              <DueBadge date={lead.data_lembrete} />
            </div>
          )}
          <p className="line-clamp-2 text-xs text-muted-foreground">
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
        <OwnerChip lead={lead} people={people} />
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
              "flex w-[85%] shrink-0 snap-start flex-col rounded-xl border border-border bg-card/50 p-2 transition sm:w-72",
              over === col.key && "border-primary bg-primary/5",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    STAGE_META[col.stages[0]]?.dot ?? "bg-zinc-400",
                  )}
                  aria-hidden
                />
                <span className="truncate">{col.label}</span>
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
