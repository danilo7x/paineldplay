import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flag, MessageSquareReply, Phone, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Person } from "../api";
import { CADENCE_KEYS, CADENCE_LABEL, CLOSE_CADENCE_KEY, type CadenceKey } from "../cadence";
import { formatDateTime, isOverdue } from "../format";
import type { Lead } from "../model";
import { OwnerChip } from "./shared";

export type CadenceRow = {
  lead: Lead;
  step: CadenceKey | typeof CLOSE_CADENCE_KEY;
  pendingId: string | null;
  due: string | null;
};

type Column = {
  key: string;
  title: string;
  hint: string;
  border: string;
  /** Soltar um cartão aqui dispara uma ação (as demais colunas avançam só pelo envio). */
  dropTarget?: "respondeu" | "sem_resposta";
};

export function CadenceBoard({
  rows,
  responded,
  noAnswer,
  people,
  waits,
  onSend,
  onRespond,
  onClose,
}: {
  rows: CadenceRow[];
  responded: Lead[];
  noAnswer: Lead[];
  people: Record<string, Person>;
  waits: Record<CadenceKey, number>;
  onSend: (row: CadenceRow) => void;
  onRespond: (lead: Lead) => void;
  onClose: (row: CadenceRow) => void;
}) {
  const [over, setOver] = useState<string | null>(null);

  const columns: Column[] = [
    ...CADENCE_KEYS.map((k, i) => ({
      key: k,
      title: CADENCE_LABEL[k],
      hint: `Sem resposta em ${waits[k]} dia(s) útil(eis) → ${i < CADENCE_KEYS.length - 1 ? CADENCE_LABEL[CADENCE_KEYS[i + 1]] : "encerrar"}`,
      border: "border-indigo-500/40",
    })),
    {
      key: CLOSE_CADENCE_KEY,
      title: "Encerrar",
      hint: "Break-up enviado; sem nova mensagem",
      border: "border-zinc-500/40",
    },
    {
      key: "respondeu",
      title: "Responderam",
      hint: "Arraste um lead para cá quando ele responder",
      border: "border-emerald-500/40",
      dropTarget: "respondeu",
    },
    {
      key: "sem_resposta",
      title: "Sem resposta",
      hint: "Encerrados nos últimos 30 dias",
      border: "border-zinc-500/40",
      dropTarget: "sem_resposta",
    },
  ];

  function handleDrop(col: Column, leadId: string) {
    const row = rows.find((r) => r.lead.id === leadId);
    if (!row || !col.dropTarget) return;
    if (col.dropTarget === "respondeu") onRespond(row.lead);
    else onClose(row);
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
      {columns.map((col) => {
        const stepRows = rows.filter((r) => r.step === col.key);
        const leadsHere =
          col.key === "respondeu" ? responded : col.key === "sem_resposta" ? noAnswer : null;
        const count = leadsHere ? leadsHere.length : stepRows.length;
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              if (!col.dropTarget) return;
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
              handleDrop(col, e.dataTransfer.getData("text/lead-id"));
            }}
            className={cn(
              "flex w-[85%] shrink-0 snap-start flex-col rounded-2xl border-2 bg-card/40 p-2 transition sm:w-72",
              col.border,
              over === col.key && "border-primary bg-primary/5",
            )}
          >
            <div className="mb-2 px-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.title}
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {count}
                </Badge>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground/80">{col.hint}</p>
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-2">
              {count === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground/60">— vazio —</p>
              )}

              {stepRows.map((r) => {
                const late = isOverdue(r.due);
                return (
                  <div
                    key={r.lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/lead-id", r.lead.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "overflow-hidden rounded-xl border border-border/60 bg-background/70 p-3",
                      late && "border-red-500/40",
                    )}
                  >
                    <Link
                      to="/leads/$id"
                      params={{ id: r.lead.id }}
                      className="block truncate text-sm font-medium hover:text-primary"
                    >
                      {r.lead.nome}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.lead.empresa ?? "Empresa não informada"}
                    </p>
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      {r.lead.telefone ?? "Sem telefone"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[11px] text-muted-foreground",
                        late && "text-red-400",
                      )}
                    >
                      {r.due
                        ? `Previsto: ${formatDateTime(r.due)}${late ? " · atrasado" : ""}`
                        : "Sem data prevista"}
                    </p>
                    <OwnerChip lead={r.lead} people={people} className="mt-1.5" />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.step === CLOSE_CADENCE_KEY ? (
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => onClose(r)}
                        >
                          <Flag className="size-3.5" /> Encerrar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => onSend(r)}
                        >
                          <Send className="size-3.5" /> Enviar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => onRespond(r.lead)}
                      >
                        <MessageSquareReply className="size-3.5" /> Respondeu
                      </Button>
                      {r.step !== CLOSE_CADENCE_KEY && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          title="Encerrar como “Sem resposta” antes do fim da cadência"
                          onClick={() => onClose(r)}
                        >
                          <Flag className="size-3.5" /> Encerrar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {leadsHere?.map((l) => (
                <Link
                  key={l.id}
                  to="/leads/$id"
                  params={{ id: l.id }}
                  className="group flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-3 transition hover:border-primary/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.nome}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {l.empresa ?? "—"}
                    </span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
