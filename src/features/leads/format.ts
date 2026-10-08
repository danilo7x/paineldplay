import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Valor para <input type="datetime-local"> no fuso do navegador. */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function fromLocalInput(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Campo só de data ("2026-10-08"): meio-dia local, para não virar o dia anterior. */
export function fromDateInput(v: string): Date | null {
  return v ? fromLocalInput(`${v}T12:00`) : null;
}

export function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

/** Dia local ("2026-10-08") de um instante salvo em UTC. */
export function localDate(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

/**
 * Atrasado = o dia previsto já passou. Mesma regra da próxima ação no Kanban e
 * na Agenda: algo previsto para hoje ainda é "para hoje", não atrasado.
 */
export function isOverdue(iso: string | null | undefined, today = todayStr()) {
  return !!iso && localDate(iso) < today;
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return format(parseISO(d), "dd/MM/yyyy");
}

export function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function initialsOf(nome: string | null | undefined) {
  return (nome ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
