import { createFileRoute, redirect } from "@tanstack/react-router";

import { FerramentasTabs } from "@/features/leads/components/FerramentasTabs";
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
      <FerramentasTabs />
      <p className="text-sm text-muted-foreground">
        Mensagens da cadência de WhatsApp e de no-show.
      </p>
      <TemplatesList canEdit={isAdmin} />
    </div>
  );
}
