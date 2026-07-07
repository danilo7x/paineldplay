import type { Database } from "@/integrations/supabase/types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type ProjectStepStatus = Database["public"]["Enums"]["project_step_status"];

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  em_desenvolvimento: {
    label: "Em desenvolvimento",
    className: "bg-primary/15 text-primary ring-1 ring-primary/30",
  },
  em_manutencao: {
    label: "Em manutenção",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  },
  concluido: {
    label: "Concluído",
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  },
  pausado: {
    label: "Pausado",
    className: "bg-muted text-muted-foreground ring-1 ring-border/50",
  },
};

export const STEP_STATUS_META: Record<
  ProjectStepStatus,
  { label: string; className: string; dot: string }
> = {
  pendente: {
    label: "Pendente",
    className: "bg-muted text-muted-foreground ring-1 ring-border/50",
    dot: "bg-muted-foreground/50",
  },
  em_andamento: {
    label: "Em andamento",
    className: "bg-primary/15 text-primary ring-1 ring-primary/30",
    dot: "bg-primary",
  },
  concluido: {
    label: "Concluído",
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    dot: "bg-emerald-400",
  },
};