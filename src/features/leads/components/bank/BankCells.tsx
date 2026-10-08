import { useEffect, useRef, useState } from "react";
import { Check, UserRound, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Person } from "../../api";
import {
  BANK_STATUSES,
  EMPTY_STATUS_COLOR,
  bankStatusColor,
  bankStatusLabel,
  inkOn,
  type BankStatus,
} from "../../bank";
import { initialsOf } from "../../format";

/** Etiqueta colorida do status (ocupa a célula inteira, como no quadro do time). */
export function StatusPill({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const color = bankStatusColor(status);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center justify-center truncate px-2 text-xs font-medium",
        className,
      )}
      style={{ backgroundColor: color, color: inkOn(color) }}
    >
      <span className="truncate">{status ? bankStatusLabel(status) : "\u00a0"}</span>
    </span>
  );
}

/** Grade de etiquetas para escolher o status (seis por coluna, como no monday). */
export function StatusGrid({
  value,
  onSelect,
  exclude = [],
}: {
  value?: string | null;
  onSelect: (status: BankStatus | null) => void;
  exclude?: BankStatus[];
}) {
  const options: { key: BankStatus | null; label: string; color: string }[] = [
    { key: null, label: "Sem status", color: EMPTY_STATUS_COLOR },
    ...BANK_STATUSES.filter((s) => !exclude.includes(s.key)),
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-flow-col sm:grid-cols-none sm:grid-rows-6">
      {options.map((o) => {
        const selected = (value ?? null) === o.key;
        return (
          <button
            key={o.key ?? "none"}
            type="button"
            onClick={() => onSelect(o.key)}
            className={cn(
              "relative flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44",
              selected && "ring-2 ring-foreground/80 ring-offset-2 ring-offset-popover",
            )}
            style={{ backgroundColor: o.color, color: inkOn(o.color) }}
            title={o.label}
          >
            <span className="truncate">{o.key ? o.label : " "}</span>
          </button>
        );
      })}
    </div>
  );
}

export function StatusCell({
  status,
  onSelect,
}: {
  status: string | null;
  onSelect: (status: BankStatus | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = bankStatusColor(status);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full min-w-0 items-center justify-center px-2 text-xs font-medium transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          style={{ backgroundColor: color, color: inkOn(color) }}
          aria-label={`Status: ${bankStatusLabel(status)}`}
        >
          <span className="truncate">{status ? bankStatusLabel(status) : "\u00a0"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="center">
        <StatusGrid
          value={status}
          onSelect={(s) => {
            setOpen(false);
            onSelect(s);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function PersonAvatar({
  person,
  className,
}: {
  person?: Person | null;
  className?: string;
}) {
  if (!person) {
    return (
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground",
          className,
        )}
      >
        <UserRound className="size-3.5" />
      </span>
    );
  }
  return (
    <Avatar className={cn("size-7 shrink-0", className)}>
      <AvatarImage src={person.avatar_url ?? undefined} alt="" />
      <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
        {initialsOf(person.nome ?? person.email)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Quem entrou em contato. Admin escolhe qualquer pessoa do comercial; os
 * demais só se colocam (ou se retiram) — o banco aplica a mesma regra.
 */
export function PersonCell({
  personId,
  person,
  people,
  userId,
  isAdmin,
  onSelect,
}: {
  personId: string | null;
  person?: Person | null;
  people: Person[];
  userId: string;
  isAdmin: boolean;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const lockedByOther = !isAdmin && !!personId && personId !== userId;
  const options = isAdmin ? people : people.filter((p) => p.id === userId);
  const name = person?.nome ?? person?.email;

  if (lockedByOther) {
    return (
      <div
        className="flex h-10 items-center gap-2 px-3"
        title={`${name ?? "Outra pessoa"} — só um admin pode transferir`}
      >
        <PersonAvatar person={person} />
        <span className="truncate text-xs text-muted-foreground">{name ?? "Outra pessoa"}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2 px-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={name ? `Quem entrou em contato: ${name}` : "Definir quem entrou em contato"}
        >
          <PersonAvatar person={personId ? person : null} />
          <span className={cn("truncate text-xs", !name && "text-muted-foreground")}>
            {personId ? (name ?? "—") : "Ninguém ainda"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start">
        <p className="px-2 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
          Quem entrou em contato
        </p>
        {options.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setOpen(false);
              onSelect(p.id);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
          >
            <PersonAvatar person={p} className="size-6" />
            <span className="min-w-0 flex-1 truncate">
              {p.nome ?? p.email}
              {p.id === userId && <span className="text-muted-foreground"> (você)</span>}
            </span>
            {p.id === personId && <Check className="size-4 text-primary" />}
          </button>
        ))}
        {personId && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSelect(null);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/60"
          >
            <X className="size-4" /> Remover
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Texto editável no lugar: clique para editar, Enter salva, Esc cancela. */
export function EditableText({
  value,
  onSave,
  placeholder = "—",
  required = false,
  className,
  inputMode,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value ?? "");
      requestAnimationFrame(() => ref.current?.select());
    }
  }, [editing, value]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (required && !next) return;
    if (next === (value ?? "")) return;
    onSave(next || null);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        inputMode={inputMode}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-10 w-full bg-background/80 px-3 text-sm outline-none ring-2 ring-inset ring-primary"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "flex h-10 w-full items-center px-3 text-left text-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
      title={value ?? undefined}
    >
      <span className={cn("truncate", !value && "text-muted-foreground/60")}>
        {value || placeholder}
      </span>
    </button>
  );
}

/** Barra de resumo dos status (proporção de cada etiqueta na lista). */
export function StatusSummaryBar({
  breakdown,
  className,
}: {
  breakdown: { key: string; label: string; color: string; count: number }[];
  className?: string;
}) {
  const total = breakdown.reduce((a, b) => a + b.count, 0);
  if (!total) return <div className={cn("h-6 rounded bg-muted/40", className)} />;
  return (
    <div
      className={cn("flex h-6 gap-[2px] overflow-hidden rounded", className)}
      role="img"
      aria-label={breakdown.map((b) => `${b.label}: ${b.count}`).join(", ")}
    >
      {breakdown.map((b) => (
        <div
          key={b.key}
          className="h-full first:rounded-l last:rounded-r"
          style={{ backgroundColor: b.color, flexGrow: b.count, minWidth: 3 }}
          title={`${b.label}: ${b.count} (${Math.round((b.count / total) * 100)}%)`}
        />
      ))}
    </div>
  );
}
