import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { leadKeys } from "./api";
import type { BankGroup, BankLead } from "./bank";

type BankInsert = Database["public"]["Tables"]["lead_bank"]["Insert"];
export type BankPatch = Database["public"]["Tables"]["lead_bank"]["Update"];
type GroupInsert = Database["public"]["Tables"]["lead_bank_groups"]["Insert"];

export const bankKeys = {
  all: ["lead-bank"] as const,
  leads: ["lead-bank", "leads"] as const,
  groups: ["lead-bank", "groups"] as const,
};

const PAGE = 1000;
/** Lotes menores que o limite de URL do PostgREST para filtros `in`. */
const ID_CHUNK = 150;
const INSERT_CHUNK = 500;

function chunks<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function friendlyError(msg: string) {
  if (msg.includes("row-level security"))
    return "Você não tem permissão para alterar o Banco de Leads.";
  return msg;
}

/** Toda a base (o PostgREST devolve no máximo 1000 linhas por vez). */
export function useBankLeads() {
  return useQuery({
    queryKey: bankKeys.leads,
    queryFn: async () => {
      const all: BankLead[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("lead_bank")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...((data ?? []) as BankLead[]));
        if (!data || data.length < PAGE) break;
      }
      return all;
    },
    staleTime: 30_000,
  });
}

export function useBankGroups() {
  return useQuery({
    queryKey: bankKeys.groups,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_bank_groups")
        .select("*")
        .order("ordem")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as BankGroup[];
    },
    staleTime: 60_000,
  });
}

/**
 * Edição de um ou vários leads. A tela muda na hora e volta atrás se o banco
 * recusar. Quando a reunião é marcada, o Kanban também é recarregado.
 */
export function useUpdateBankLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: BankPatch; success?: string }) => {
      const saved: BankLead[] = [];
      for (const part of chunks(ids, ID_CHUNK)) {
        const { data, error } = await supabase
          .from("lead_bank")
          .update(patch)
          .in("id", part)
          .select("*");
        if (error) throw new Error(friendlyError(error.message));
        saved.push(...((data ?? []) as BankLead[]));
      }
      return saved;
    },
    onMutate: async ({ ids, patch }) => {
      await qc.cancelQueries({ queryKey: bankKeys.leads });
      const previous = qc.getQueryData<BankLead[]>(bankKeys.leads);
      const set = new Set(ids);
      qc.setQueryData<BankLead[]>(bankKeys.leads, (rows) =>
        rows?.map((r) => (set.has(r.id) ? ({ ...r, ...patch } as BankLead) : r)),
      );
      return { previous };
    },
    onSuccess: (saved, vars) => {
      const byId = new Map(saved.map((r) => [r.id, r]));
      qc.setQueryData<BankLead[]>(bankKeys.leads, (rows) => rows?.map((r) => byId.get(r.id) ?? r));
      if (vars.patch.status === "reuniao_marcada" || vars.patch.reuniao_em !== undefined) {
        qc.invalidateQueries({ queryKey: leadKeys.all });
      }
      if (vars.success) toast.success(vars.success);
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(bankKeys.leads, ctx.previous);
      toast.error("Não foi possível salvar", { description: e.message });
    },
  });
}

export function useCreateBankLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rows,
      onProgress,
    }: {
      rows: BankInsert[];
      onProgress?: (done: number) => void;
      silent?: boolean;
    }) => {
      const saved: BankLead[] = [];
      for (const part of chunks(rows, INSERT_CHUNK)) {
        const { data, error } = await supabase.from("lead_bank").insert(part).select("*");
        if (error) throw new Error(friendlyError(error.message));
        saved.push(...((data ?? []) as BankLead[]));
        onProgress?.(saved.length);
      }
      return saved;
    },
    onSuccess: (saved) => {
      qc.setQueryData<BankLead[]>(bankKeys.leads, (rows) => [...saved, ...(rows ?? [])]);
      if (saved.some((r) => r.lead_id)) qc.invalidateQueries({ queryKey: leadKeys.all });
    },
    onError: (e: Error, vars) => {
      if (!vars.silent) toast.error("Não foi possível cadastrar", { description: e.message });
      qc.invalidateQueries({ queryKey: bankKeys.leads });
    },
  });
}

export function useDeleteBankLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const removed: string[] = [];
      for (const part of chunks(ids, ID_CHUNK)) {
        const { data, error } = await supabase
          .from("lead_bank")
          .delete()
          .in("id", part)
          .select("id");
        if (error) throw new Error(friendlyError(error.message));
        removed.push(...(data ?? []).map((r) => r.id));
      }
      return removed;
    },
    onSuccess: (removed, ids) => {
      const gone = new Set(removed);
      qc.setQueryData<BankLead[]>(bankKeys.leads, (rows) => rows?.filter((r) => !gone.has(r.id)));
      if (removed.length < ids.length) {
        // O RLS só deixa apagar o que a pessoa cadastrou (admin apaga tudo).
        toast.warning(`${removed.length} de ${ids.length} excluídos`, {
          description: "Os demais foram cadastrados por outra pessoa; peça a um admin.",
        });
      } else {
        toast.success(removed.length === 1 ? "Lead excluído" : `${removed.length} leads excluídos`);
      }
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });
}

export function useSaveBankGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: GroupInsert & { id?: string }) => {
      const { id, ...fields } = group;
      const q = id
        ? supabase.from("lead_bank_groups").update(fields).eq("id", id)
        : supabase.from("lead_bank_groups").insert(fields);
      const { data, error } = await q.select("*").single();
      if (error) throw new Error(friendlyError(error.message));
      return data as BankGroup;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.groups }),
    onError: (e: Error) =>
      toast.error("Não foi possível salvar a lista", { description: e.message }),
  });
}

export function useDeleteBankGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_bank_groups").delete().eq("id", id);
      if (error) throw new Error(friendlyError(error.message));
    },
    onSuccess: () => {
      toast.success("Lista excluída", { description: "Os leads dela ficaram em “Sem lista”." });
      qc.invalidateQueries({ queryKey: bankKeys.all });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });
}
