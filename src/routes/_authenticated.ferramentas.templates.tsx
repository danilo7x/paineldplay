import { createFileRoute, redirect } from "@tanstack/react-router";

import { PageHeader } from "@/features/leads/components/LeadFilters";
import { TemplatesList } from "@/features/leads/components/ScriptAndTemplates";

export const Route = createFileRoute("/_authenticated/ferramentas/templates")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: TemplatesPage,
});

function TemplatesPage() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <div className="space-y-6">
      <PageHeader
        section="Ferramentas"
        title="Templates"
        description={`Mensagens da cadência de WhatsApp e de no-show. Os campos entre colchetes são preenchidos com os dados do lead ao preparar a mensagem.${
          isAdmin ? "" : " Somente administradores podem editar."
        }`}
      />
      <TemplatesList canEdit={isAdmin} />
    </div>
  );
}
