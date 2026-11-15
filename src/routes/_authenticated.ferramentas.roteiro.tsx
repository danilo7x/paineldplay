import { createFileRoute, redirect } from "@tanstack/react-router";

import { FerramentasTabs } from "@/features/leads/components/FerramentasTabs";
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
      <FerramentasTabs />
      <p className="text-sm text-muted-foreground">Material de apoio para o primeiro contato.</p>
      <div className="max-w-3xl">
        <CallScriptContent />
      </div>
    </div>
  );
}
