import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ClipboardCheck, Flag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatarData } from "./meta";
import {
  INTERESSES,
  NPS_META,
  PESQUISA_META,
  escalaDe,
  formatarMedia,
  mediaPesquisa,
  npsCategoria,
  tomMedia,
  type Pesquisa,
  type PesquisaTipo,
} from "./pesquisa";

type Props = {
  pesquisas: Pesquisa[];
  canEdit: boolean;
  podeExcluir: (p: Pesquisa) => boolean;
  onNova: (tipo: PesquisaTipo) => void;
  onExcluir: (id: string) => void;
};

const BARRA = { bom: "bg-emerald-400", medio: "bg-amber-400", ruim: "bg-red-400" } as const;

function somarMeses(data: string, meses: number) {
  const d = new Date(`${data.slice(0, 10)}T00:00:00`);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

/** Resultado das pesquisas de satisfação do projeto, no formato das reuniões. */
export function SatisfacaoCard({ pesquisas, canEdit, podeExcluir, onNova, onExcluir }: Props) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const atual = pesquisas.find((p) => p.id === selecionada) ?? pesquisas[0];
  const idx = atual ? pesquisas.indexOf(atual) : -1;
  const anterior = idx >= 0 ? pesquisas[idx + 1] : undefined;
  const media = atual ? mediaPesquisa(atual) : null;
  const mediaAnterior = anterior ? mediaPesquisa(anterior) : null;
  const variacao = media != null && mediaAnterior != null ? media - mediaAnterior : null;

  return (
    <Card className="rounded-xl border-border bg-card" data-testid="satisfacao-card">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Satisfação do cliente</h3>
            <p className="text-sm text-muted-foreground">
              Registre as respostas na própria reunião de alinhamento final.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-2" onClick={() => onNova("raf")}>
                <Flag className="size-4" /> Pesquisa final (RAF)
              </Button>
              {/* Coleta no meio do projeto é rara (projetos pequenos), por isso fica discreta. */}
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 text-muted-foreground"
                onClick={() => onNova("coleta")}
              >
                <ClipboardCheck className="size-4" /> Coleta intermediária
              </Button>
            </div>
          )}
        </div>

        {!atual ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm">
            <p className="font-medium">Ainda sem pesquisa de satisfação</p>
            <p className="mt-1 text-muted-foreground">
              Na reunião de alinhamento final, clique em “Pesquisa final (RAF)” e marque as
              respostas do cliente: {PESQUISA_META.raf.perguntas.length} perguntas de satisfação,
              recomendação de 1 a 10, feedback aberto e interesse em outras soluções.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Em projetos mais longos, use a coleta intermediária para medir no meio do caminho.
            </p>
          </div>
        ) : (
          <>
            {/* Números principais */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Satisfação</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                  {media != null ? (
                    <>
                      <span aria-hidden>{escalaDe(media).emoji}</span>
                      {formatarMedia(media)}
                      <span className="text-sm font-normal text-muted-foreground">de 5</span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                {variacao != null && Math.abs(variacao) >= 0.05 && (
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-1 text-xs",
                      variacao > 0 ? "text-emerald-300" : "text-red-300",
                    )}
                  >
                    {variacao > 0 ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                    {variacao > 0 ? "+" : "−"}
                    {formatarMedia(Math.abs(variacao))} desde a pesquisa anterior
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Recomendação</p>
                <p className="mt-1 text-2xl font-semibold">
                  {atual.nps ?? "—"}
                  {atual.nps != null && (
                    <span className="text-sm font-normal text-muted-foreground"> de 10</span>
                  )}
                </p>
                {atual.nps != null && (
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                      NPS_META[npsCategoria(atual.nps)].classe,
                    )}
                  >
                    {NPS_META[npsCategoria(atual.nps)].label}
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">{PESQUISA_META[atual.tipo].titulo}</p>
                <p className="mt-1 text-sm font-medium">{formatarData(atual.data)}</p>
                {atual.tipo === "raf" && atual.meses_acompanhamento ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acompanhamento até{" "}
                    {formatarData(somarMeses(atual.data, atual.meses_acompanhamento))} (
                    {atual.meses_acompanhamento} meses)
                  </p>
                ) : null}
              </div>
            </div>

            {/* Respostas por pergunta */}
            <ul className="space-y-2.5">
              {PESQUISA_META[atual.tipo].perguntas.map((p) => {
                const n = atual[p.chave];
                if (n == null) return null;
                const e = escalaDe(n);
                return (
                  <li
                    key={p.chave}
                    className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_130px]"
                  >
                    <p className="text-sm">{p.texto}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", BARRA[tomMedia(n)])}
                        style={{ width: `${(n / 5) * 100}%` }}
                      />
                    </div>
                    <p className={cn("text-xs", e.cor)}>
                      <span aria-hidden>{e.emoji}</span> {e.label}
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Feedback aberto */}
            {(atual.funcionou_bem || atual.melhorar || atual.sugestoes) && (
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["O que funcionou bem", atual.funcionou_bem],
                    ["O que podemos melhorar", atual.melhorar],
                    ["Sugestões de próximos passos", atual.sugestoes],
                  ] as const
                ).map(([titulo, texto]) =>
                  texto ? (
                    <div key={titulo} className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">{titulo}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{texto}</p>
                    </div>
                  ) : null,
                )}
              </div>
            )}

            {atual.tipo === "raf" && atual.interesses.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Interesse em:</span>
                {atual.interesses.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary"
                  >
                    {INTERESSES.find((x) => x.chave === i)?.label ?? i}
                  </span>
                ))}
              </div>
            )}

            {/* Histórico de pesquisas */}
            {pesquisas.length > 1 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Todas as pesquisas</p>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {pesquisas.map((p) => {
                    const m = mediaPesquisa(p);
                    return (
                      <li key={p.id} className="group flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelecionada(p.id)}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-accent/50",
                            p.id === atual.id && "bg-accent/60",
                          )}
                        >
                          <span className="w-16 shrink-0 text-xs text-muted-foreground">
                            {formatarData(p.data)}
                          </span>
                          <span className="w-14 shrink-0 text-xs">
                            {PESQUISA_META[p.tipo].curto}
                          </span>
                          <span className="flex-1">
                            {m != null ? `${escalaDe(m).emoji} ${formatarMedia(m)}` : "—"}
                          </span>
                          {p.nps != null && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                NPS_META[npsCategoria(p.nps)].classe,
                              )}
                            >
                              {p.nps}
                            </span>
                          )}
                        </button>
                        {podeExcluir(p) && (
                          <button
                            type="button"
                            aria-label="Excluir pesquisa"
                            onClick={() => onExcluir(p.id)}
                            className="mr-2 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {pesquisas.length === 1 && podeExcluir(atual) && (
              <button
                type="button"
                onClick={() => onExcluir(atual.id)}
                className="text-xs text-muted-foreground transition hover:text-destructive"
              >
                Excluir esta pesquisa
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
