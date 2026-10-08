import { createFileRoute, redirect } from "@tanstack/react-router";

import { PageHeader } from "@/features/leads/components/LeadFilters";
import { ObjectionsBrowser } from "@/features/leads/components/ScriptAndTemplates";

export const Route = createFileRoute("/_authenticated/ferramentas/objecoes")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: ObjecoesPage,
});

function ObjecoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        section="Ferramentas"
        title="Matriz de Objeções"
        description="Como conduzir as objeções mais comuns na qualificação e na proposta."
      />
      <ObjectionsBrowser />
    </div>
  );
}
