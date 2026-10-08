import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Lead, LeadActivity, MessageTemplate } from "./model";
import type { LeadChange } from "./workflow";

export const leadKeys = {
  all: ["leads"] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
  activities: (id: string) => ["leads", "activities", id] as const,
  pending: ["leads", "pending"] as const,
  templates: ["leads", "templates"] as const,
  people: ["leads", "people"] as const,
};

export function useLeads() {
  return useQuery({
    queryKey: leadKeys.all,
    queryFn: async () => {
      // O RLS devolve tudo para admins e só os leads atribuídos para os demais.
      const { data, error } = await supabase
        .from("partner_leads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Lead | null;
    },
  });
}

export function useLeadActivities(id: string) {
  return useQuery({
    queryKey: leadKeys.activities(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LeadActivity[];
    },
  });
}

/** Ações previstas de todos os leads visíveis (para lembretes no painel). */
export function usePendingActivities() {
  return useQuery({
    queryKey: leadKeys.pending,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("id, lead_id, tipo, titulo, chave, previsto_para")
        .eq("status", "prevista")
        .order("previsto_para", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: leadKeys.templates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_message_templates")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as MessageTemplate[];
    },
    staleTime: 5 * 60_000,
  });
}

export type Person = {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

/**
 * Pessoas que podem ser responsáveis por leads: admins e usuários com acesso
 * comercial, menos quem foi ocultado em Equipe (ex.: a conta da empresa).
 * Fora da administração, a lista contém apenas o próprio usuário (o RLS de
 * profiles não expõe os demais).
 */
export function useCommercialPeople() {
  return useQuery({
    queryKey: leadKeys.people,
    queryFn: async () => {
      const [{ data: roles }, { data: access }, { data: hidden }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
        supabase.from("commercial_access").select("user_id"),
        supabase.from("commercial_owner_hidden").select("user_id"),
      ]);
      const hiddenIds = new Set((hidden ?? []).map((h) => h.user_id));
      const ids = Array.from(
        new Set([...(roles ?? []).map((r) => r.user_id), ...(access ?? []).map((a) => a.user_id)]),
      ).filter((id) => !hiddenIds.has(id));
      if (!ids.length) return [] as Person[];
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url, ativo")
        .in("id", ids)
        .order("nome");
      return (data ?? []).filter((p) => p.ativo !== false) as Person[];
    },
    staleTime: 60_000,
  });
}

/** Perfis por id (para mostrar responsáveis e autores do histórico). */
export function usePeopleMap(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[])).sort();
  return useQuery({
    queryKey: ["leads", "people-map", unique.join(",")],
    queryFn: async () => {
      if (!unique.length) return {} as Record<string, Person>;
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .in("id", unique);
      const map: Record<string, Person> = {};
      (data ?? []).forEach((p) => (map[p.id] = p as Person));
      return map;
    },
    enabled: unique.length > 0,
    staleTime: 60_000,
  });
}

export async function applyLeadChange(leadId: string, change: LeadChange) {
  const { error } = await supabase.rpc("lead_apply_changes", {
    _lead_id: leadId,
    _patch: change.patch as unknown as Json,
    _activities: change.activities as unknown as Json,
    _activity_updates: change.updates as unknown as Json,
    _cancel_pending: change.cancelPending,
  });
  if (error) throw new Error(friendlyError(error.message));
}

function friendlyError(msg: string) {
  if (msg.includes("uq_lead_activities_whatsapp_enviado"))
    return "Esta mensagem já foi registrada como enviada neste ciclo.";
  if (msg.includes("uq_lead_activities_prevista_chave"))
    return "Já existe uma ação prevista igual para este lead.";
  if (msg.includes("row-level security") || msg.includes("sem permissão"))
    return "Você não tem permissão para alterar este lead.";
  return msg;
}

/** Aplica uma mudança e atualiza as listas da página. */
export function useApplyLeadChange(leadId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ change, id }: { change: LeadChange; id?: string; success?: string }) => {
      const target = id ?? leadId;
      if (!target) throw new Error("Lead não informado");
      await applyLeadChange(target, change);
    },
    onSuccess: (_d, vars) => {
      if (vars.success) toast.success(vars.success);
      qc.invalidateQueries({ queryKey: leadKeys.all });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });
}
