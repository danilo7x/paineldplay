import { Link, useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

const ABAS = [
  { to: "/ferramentas/templates", label: "Templates" },
  { to: "/ferramentas/roteiro", label: "Roteiro de ligação" },
  { to: "/ferramentas/objecoes", label: "Matriz de objeções" },
] as const;

/** Abas das ferramentas de venda: as três páginas ficam num só item do menu. */
export function FerramentasTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Ferramentas de venda" className="flex gap-1 overflow-x-auto border-b border-border">
      {ABAS.map((aba) => {
        const ativa = pathname.startsWith(aba.to);
        return (
          <Link
            key={aba.to}
            to={aba.to}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition",
              ativa
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
