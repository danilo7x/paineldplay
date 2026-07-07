import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, DollarSign, FolderKanban, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const kpis = [
  { label: "Receita do mês", value: "R$ —", icon: DollarSign, hint: "Aguardando dados" },
  { label: "Projetos ativos", value: "0", icon: FolderKanban, hint: "Nenhum cadastrado" },
  { label: "Vendas no mês", value: "0", icon: TrendingUp, hint: "Nenhuma venda" },
  { label: "Equipe", value: "1", icon: Users, hint: "Sócios + funcionários" },
];

function DashboardPage() {
  const { user, isAdmin } = Route.useRouteContext();
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Visão geral</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Olá, {user.email?.split("@")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Você tem acesso total ao painel."
              : "Seus projetos e faturamento aparecerão aqui."}
          </p>
        </div>
        <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {isAdmin ? "Administrador" : "Colaborador"}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="border-border/50 bg-card/60 backdrop-blur transition hover:border-primary/40"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{k.value}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <k.icon className="size-4" />
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRight className="size-3" /> {k.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="p-8">
          <h2 className="text-lg font-semibold">Evolução do faturamento</h2>
          <p className="text-sm text-muted-foreground">
            Assim que você cadastrar vendas na Fase 4, o gráfico aparecerá aqui.
          </p>
          <div
            className="mt-6 h-56 rounded-xl border border-dashed border-border/60"
            style={{
              background:
                "linear-gradient(180deg, rgba(5,126,243,0.08), rgba(1,87,198,0.02))",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}