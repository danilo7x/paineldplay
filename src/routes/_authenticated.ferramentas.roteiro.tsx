import { createFileRoute, redirect } from "@tanstack/react-router";

import { PageHeader } from "@/features/leads/components/LeadFilters";
import { CallScriptContent } from "@/features/leads/components/ScriptAndTemplates";

export const Route = createFileRoute("/_authenticated/ferramentas/roteiro")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: RoteiroPage,
});

function RoteiroPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        section="Ferramentas"
        title="Roteiro de ligação"
        description="Material de apoio para o primeiro contato. Adapte as frases à conversa: o objetivo é entender a necessidade e, se fizer sentido, marcar a reunião de diagnóstico."
      />
      <div className="max-w-3xl">
        <CallScriptContent />
      </div>
    </div>
  );
}
