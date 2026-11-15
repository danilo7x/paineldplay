import { createFileRoute, redirect } from "@tanstack/react-router";

import { FerramentasTabs } from "@/features/leads/components/FerramentasTabs";
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
      <FerramentasTabs />
      <p className="text-sm text-muted-foreground">Como conduzir as objeções mais comuns.</p>
      <ObjectionsBrowser />
    </div>
  );
}
