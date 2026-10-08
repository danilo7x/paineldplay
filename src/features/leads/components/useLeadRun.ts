import { useEffect, useState } from "react";

import { useApplyLeadChange } from "../api";
import type { Lead } from "../model";
import type { LeadChange } from "../workflow";

/** Monta a mudança, aplica e fecha o diálogo; erros de validação aparecem no rodapé. */
export function useLeadRun(lead: Lead, onOpenChange: (v: boolean) => void, open?: boolean) {
  const apply = useApplyLeadChange(lead.id);
  const [error, setError] = useState<string | null>(null);
  // Erro de uma tentativa anterior não reaparece quando o diálogo é reaberto.
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  const run = (build: () => LeadChange, success: string) => {
    setError(null);
    let change: LeadChange;
    try {
      change = build();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    apply.mutate({ change, success }, { onSuccess: () => onOpenChange(false) });
  };
  return { run, error, pending: apply.isPending };
}
