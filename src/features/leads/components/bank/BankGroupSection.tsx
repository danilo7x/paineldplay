import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Columns3,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Person } from "../../api";
import {
  EMPTY_STATUS_COLOR,
  MEETING_STATUS,
  statusBreakdown,
  type BankGroup,
  type BankLead,
  type BankStatus,
} from "../../bank";
import type { BankPatch } from "../../bank-api";
import { formatDate } from "../../format";
import { EditableText, PersonCell, StatusCell, StatusSummaryBar } from "./BankCells";

const PAGE = 50;

export type BankRowActions = {
  update: (lead: BankLead, patch: BankPatch) => void;
  changeStatus: (lead: BankLead, status: BankStatus | null) => void;
  editMeeting: (lead: BankLead) => void;
  edit: (lead: BankLead) => void;
  remove: (lead: BankLead) => void;
  quickAdd: (groupId: string | null, nome: string) => void;
};

export function BankGroupSection({
  group,
  leads,
  people,
  peopleMap,
  userId,
  isAdmin,
  selected,
  onToggle,
  onToggleAll,
  actions,
  onEditGroup,
  onDeleteGroup,
  onAddLead,
}: {
  /** null = leads sem lista */
  group: BankGroup | null;
  leads: BankLead[];
  people: Person[];
  peopleMap: Record<string, Person>;
  userId: string;
  isAdmin: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  actions: BankRowActions;
  onEditGroup?: () => void;
  onDeleteGroup?: () => void;
  onAddLead: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [draft, setDraft] = useState("");
  const color = group?.cor ?? EMPTY_STATUS_COLOR;
  const name = group?.nome ?? "Sem lista";
  const breakdown = statusBreakdown(leads);
  const ids = leads.map((l) => l.id);
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  const someOn = !allOn && ids.some((id) => selected.has(id));
  const rows = leads.slice(0, limit);

  function submitDraft() {
    const nome = draft.trim();
    if (!nome) return;
    actions.quickAdd(group?.id ?? null, nome);
    setDraft("");
  }

  return (
    <section className="space-y-2">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 rounded-md py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0" style={{ color }} />
          ) : (
            <ChevronRight className="size-4 shrink-0" style={{ color }} />
          )}
          <span className="truncate text-lg font-semibold" style={{ color }}>
            {name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {leads.length.toLocaleString("pt-BR")} {leads.length === 1 ? "lead" : "leads"}
          </span>
        </button>
        <StatusSummaryBar breakdown={breakdown} className="w-40 sm:w-56" />
        {group && (onEditGroup || onDeleteGroup) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Opções da lista">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onAddLead}>
                <Plus className="size-4" /> Adicionar lead
              </DropdownMenuItem>
              {onEditGroup && (
                <DropdownMenuItem onClick={onEditGroup}>
                  <Pencil className="size-4" /> Renomear / cor
                </DropdownMenuItem>
              )}
              {onDeleteGroup && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDeleteGroup}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" /> Excluir lista
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {open && (
        <div
          className="overflow-x-auto rounded-xl border border-l-[3px] border-border/50 bg-card/50"
          style={{ borderLeftColor: color }}
        >
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 w-10 bg-card px-3 py-2">
                  <Checkbox
                    checked={allOn ? true : someOn ? "indeterminate" : false}
                    onCheckedChange={(v) => onToggleAll(ids, v === true)}
                    aria-label={`Selecionar todos de ${name}`}
                  />
                </th>
                <th className="sticky left-10 z-10 w-56 border-r border-border/40 bg-card px-3 py-2 text-left font-medium">
                  Nome
                </th>
                <th className="w-52 border-r border-border/40 px-3 py-2 text-left font-medium">
                  Nome da empresa
                </th>
                <th className="w-40 border-r border-border/40 px-3 py-2 text-left font-medium">
                  Telefone
                </th>
                <th className="w-48 border-r border-border/40 px-3 py-2 text-left font-medium">
                  Quem entrou em contato
                </th>
                <th className="w-44 border-r border-border/40 px-3 py-2 font-medium">
                  Status do lead
                </th>
                <th className="w-44 border-r border-border/40 px-3 py-2 text-left font-medium">
                  Data da reunião
                </th>
                <th className="w-20 border-r border-border/40 px-3 py-2 font-medium">Kanban</th>
                <th className="w-24 px-3 py-2 text-left font-medium">Cadastro</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const person = l.contato_por ? peopleMap[l.contato_por] : null;
                const isSelected = selected.has(l.id);
                const canOpenKanban = !!l.lead_id && (isAdmin || l.contato_por === userId);
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      "group border-b border-border/40 last:border-b-0",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/20",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 px-3",
                        isSelected
                          ? "bg-[color-mix(in_oklab,var(--card),var(--primary)_10%)]"
                          : "bg-card",
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(l.id)}
                        aria-label={`Selecionar ${l.nome}`}
                      />
                    </td>
                    <td
                      className={cn(
                        "sticky left-10 z-10 max-w-56 border-r border-border/40 p-0",
                        isSelected
                          ? "bg-[color-mix(in_oklab,var(--card),var(--primary)_10%)]"
                          : "bg-card",
                      )}
                    >
                      <EditableText
                        value={l.nome}
                        required
                        onSave={(v) => v && actions.update(l, { nome: v })}
                      />
                    </td>
                    <td className="max-w-52 border-r border-border/40 p-0">
                      <EditableText
                        value={l.empresa}
                        onSave={(v) => actions.update(l, { empresa: v })}
                        className="text-muted-foreground"
                      />
                    </td>
                    <td className="max-w-40 border-r border-border/40 p-0">
                      <EditableText
                        value={l.telefone}
                        inputMode="tel"
                        onSave={(v) => actions.update(l, { telefone: v })}
                        className="tabular-nums text-muted-foreground"
                      />
                    </td>
                    <td className="max-w-48 border-r border-border/40 p-0">
                      <PersonCell
                        personId={l.contato_por}
                        person={person}
                        people={people}
                        userId={userId}
                        isAdmin={isAdmin}
                        onSelect={(id) => actions.update(l, { contato_por: id })}
                      />
                    </td>
                    <td className="w-44 border-r border-border/40 p-0">
                      <StatusCell status={l.status} onSelect={(s) => actions.changeStatus(l, s)} />
                    </td>
                    <td className="border-r border-border/40 p-0">
                      <MeetingCell lead={l} onEdit={() => actions.editMeeting(l)} />
                    </td>
                    <td className="border-r border-border/40 px-3 text-center">
                      {canOpenKanban ? (
                        <Link
                          to="/leads/$id"
                          params={{ id: l.lead_id! }}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-primary hover:bg-primary/10"
                          title="Abrir no Kanban"
                        >
                          <Columns3 className="size-3.5" /> Ver
                        </Link>
                      ) : l.lead_id ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                          title="No Kanban de quem entrou em contato"
                        >
                          <Columns3 className="size-3.5" /> Sim
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 text-xs tabular-nums text-muted-foreground">
                      {formatDate(l.created_at.slice(0, 10))}
                    </td>
                    <td className="px-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-60 group-hover:opacity-100"
                            aria-label={`Ações de ${l.nome}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => actions.edit(l)}>
                            <Pencil className="size-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => actions.remove(l)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border/40">
                <td className="sticky left-0 z-10 bg-card px-3">
                  <Plus className="size-4 text-muted-foreground" />
                </td>
                <td
                  className="sticky left-10 z-10 border-r border-border/40 bg-card p-0"
                  colSpan={1}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitDraft()}
                    onBlur={submitDraft}
                    placeholder="+ Adicionar lead"
                    className="h-10 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-inset focus:ring-primary"
                    aria-label={`Adicionar lead em ${name}`}
                  />
                </td>
                <td colSpan={8} />
              </tr>
            </tbody>
          </table>
          {leads.length > limit && (
            <div className="border-t border-border/40 p-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + 200)}>
                Mostrar mais ({(leads.length - limit).toLocaleString("pt-BR")} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MeetingCell({ lead, onEdit }: { lead: BankLead; onEdit: () => void }) {
  if (lead.reuniao_em) {
    const d = new Date(lead.reuniao_em);
    return (
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "flex h-10 w-full items-center gap-1.5 whitespace-nowrap px-3 text-left text-xs tabular-nums transition hover:bg-muted/40",
          lead.status !== MEETING_STATUS && "text-muted-foreground line-through",
        )}
        title={
          lead.status === MEETING_STATUS
            ? "Alterar a data (reagenda no Kanban)"
            : "Reunião de um status anterior"
        }
      >
        <CalendarClock className="size-3.5 shrink-0 text-primary" />
        {format(d, "dd/MM/yyyy HH:mm")}
      </button>
    );
  }
  if (lead.status === MEETING_STATUS) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex h-10 w-full items-center gap-1.5 px-3 text-left text-xs font-medium text-amber-400 transition hover:bg-amber-500/10"
      >
        <CalendarClock className="size-3.5" /> Definir data
      </button>
    );
  }
  return <span className="block px-3 text-xs text-muted-foreground/50">—</span>;
}
