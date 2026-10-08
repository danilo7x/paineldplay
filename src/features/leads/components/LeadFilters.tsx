import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommercialPeople } from "../api";
import type { ActionFilter, LeadFilterState } from "../filters";
import { ACTIVE_STAGES, CANAL_ORIGEM, FINAL_STAGES, STAGE_META } from "../model";

export function LeadFiltersBar({
  filters,
  set,
  isAdmin,
  showCanal = false,
  showAction = true,
  children,
}: {
  filters: LeadFilterState;
  set: <K extends keyof LeadFilterState>(k: K, v: LeadFilterState[K]) => void;
  isAdmin: boolean;
  showCanal?: boolean;
  showAction?: boolean;
  children?: React.ReactNode;
}) {
  const { data: people = [] } = useCommercialPeople();
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Buscar por nome, empresa ou contato"
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
        <Select value={filters.stage} onValueChange={(v) => set("stage", v)}>
          <SelectTrigger className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as etapas</SelectItem>
            <SelectItem value="ativas">Em andamento</SelectItem>
            <SelectItem value="encerradas">Encerradas</SelectItem>
            {[...ACTIVE_STAGES, ...FINAL_STAGES].map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={filters.owner} onValueChange={(v) => set("owner", v)}>
            <SelectTrigger className="lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              <SelectItem value="sem">Sem responsável</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome ?? p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showCanal && (
          <Select value={filters.canal} onValueChange={(v) => set("canal", v)}>
            <SelectTrigger className="lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              {CANAL_ORIGEM.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
              <SelectItem value="nao_informado">Não informada</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showAction && (
          <Select value={filters.action} onValueChange={(v) => set("action", v as ActionFilter)}>
            <SelectTrigger className="lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as próximas ações</SelectItem>
              <SelectItem value="hoje_atrasadas">Hoje e atrasadas</SelectItem>
              <SelectItem value="atrasadas">Atrasadas</SelectItem>
              <SelectItem value="hoje">Para hoje</SelectItem>
              <SelectItem value="semana">Próximos 7 dias</SelectItem>
              <SelectItem value="sem_acao">Sem próxima ação</SelectItem>
            </SelectContent>
          </Select>
        )}
        {children}
      </div>
    </div>
  );
}

/** Cabeçalho padrão das páginas das seções Acompanhamento de Leads e Ferramentas. */
export function PageHeader({
  section,
  title,
  description,
  actions,
}: {
  section: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{section}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
