import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";

import { todayStr } from "./format";
import { dueState, isFinalStage, type Lead } from "./model";

export type ActionFilter =
  "todas" | "atrasadas" | "hoje" | "hoje_atrasadas" | "semana" | "sem_acao";

export type LeadFilterState = {
  search: string;
  stage: string;
  owner: string;
  action: ActionFilter;
  canal: string;
};

export const EMPTY_FILTERS: LeadFilterState = {
  search: "",
  stage: "todas",
  owner: "todos",
  action: "todas",
  canal: "todos",
};

export type LeadFilterOptions = {
  /** Filtra pelo dono da próxima ação (Agenda) em vez do responsável pelo lead. */
  byNextActionOwner?: boolean;
};

export function applyLeadFilters(
  leads: Lead[],
  f: LeadFilterState,
  today = todayStr(),
  opts: LeadFilterOptions = {},
) {
  const weekEnd = format(addDays(new Date(`${today}T12:00:00`), 7), "yyyy-MM-dd");
  const q = f.search.trim().toLowerCase();
  return leads.filter((l) => {
    if (q) {
      const hay = [l.nome, l.empresa, l.contato, l.telefone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.stage === "ativas" && isFinalStage(l.etapa)) return false;
    if (f.stage === "encerradas" && !isFinalStage(l.etapa)) return false;
    if (!["todas", "ativas", "encerradas"].includes(f.stage) && l.etapa !== f.stage) return false;
    const owner = opts.byNextActionOwner
      ? (l.proxima_acao_responsavel_id ?? l.responsavel_id)
      : l.responsavel_id;
    if (f.owner === "sem" && (owner || l.responsavel_externo)) return false;
    if (f.owner === "outro" && (owner || !l.responsavel_externo)) return false;
    if (!["todos", "sem", "outro"].includes(f.owner) && owner !== f.owner) return false;
    if (
      f.canal !== "todos" &&
      (l.canal_origem ?? "") !== (f.canal === "nao_informado" ? "" : f.canal)
    )
      return false;
    if (f.action !== "todas") {
      if (isFinalStage(l.etapa)) return false;
      const d = dueState(l.data_lembrete, today);
      if (f.action === "atrasadas" && d !== "atrasada") return false;
      if (f.action === "hoje" && d !== "hoje") return false;
      if (f.action === "hoje_atrasadas" && d !== "hoje" && d !== "atrasada") return false;
      if (
        f.action === "semana" &&
        (!l.data_lembrete || l.data_lembrete < today || l.data_lembrete > weekEnd)
      )
        return false;
      if (f.action === "sem_acao" && l.data_lembrete) return false;
    }
    return true;
  });
}

export function useLeadFilters(
  leads: Lead[],
  initial: Partial<LeadFilterState> = {},
  opts: LeadFilterOptions = {},
) {
  const [filters, setFilters] = useState<LeadFilterState>({ ...EMPTY_FILTERS, ...initial });
  const byNext = !!opts.byNextActionOwner;
  const filtered = useMemo(
    () => applyLeadFilters(leads, filters, todayStr(), { byNextActionOwner: byNext }),
    [leads, filters, byNext],
  );
  const set = <K extends keyof LeadFilterState>(k: K, v: LeadFilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));
  return { filters, set, filtered };
}
