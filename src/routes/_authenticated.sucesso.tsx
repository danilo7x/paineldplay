import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ClipboardCheck, HeartHandshake, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatarData, tabelaAusente, type ProjectCS } from "@/features/sucesso/meta";
import { PesquisaDialog } from "@/features/sucesso/PesquisaDialog";
import {
  NPS_META,
  TEMAS,
  calcularNps,
  escalaDe,
  formatarMedia,
  mediaPesquisa,
  npsCategoria,
  tomMedia,
  type Pesquisa,
} from "@/features/sucesso/pesquisa";

export const Route = createFileRoute("/_authenticated/sucesso")({
  component: SucessoPage,
});

type Projeto = { id: string; nome: string; cliente: string | null; status: string };

/** Situação de cada projeto do ponto de vista da satisfação do cliente. */
type Situacao = "insatisfeito" | "aguardando" | "neutro" | "satisfeito" | "em_andamento";

type Linha = Projeto & {
  pesquisa: Pesquisa | undefined;
  media: number | null;
  nps: number | null;
  situacao: Situacao;
};

type Filtro = "todos" | "aguardando" | "insatisfeito";

const ORDEM: Record<Situacao, number> = {
  insatisfeito: 0,
  aguardando: 1,
  neutro: 2,
  satisfeito: 3,
  em_andamento: 4,
};

/** A carinha segue a situação (e não só a média), para não destoar do rótulo. */
const SITUACAO_META: Record<Situacao, { label: string; classe: string; emoji?: string }> = {
  insatisfeito: { label: "Insatisfeito", classe: "text-red-300", emoji: "🙁" },
  aguardando: { label: "Aguardando pesquisa", classe: "text-primary" },
  neutro: { label: "Neutro", classe: "text-amber-300", emoji: "😐" },
  satisfeito: { label: "Satisfeito", classe: "text-emerald-300", emoji: "😄" },
  em_andamento: { label: "Pesquisa na entrega", classe: "text-muted-foreground" },
};

const STATUS_LABEL: Record<string, string> = {
  em_desenvolvimento: "Em desenvolvimento",
  em_manutencao: "Em manutenção",
  concluido: "Concluído",
  pausado: "Pausado",
};

const BARRA = { bom: "bg-emerald-400", medio: "bg-amber-400", ruim: "bg-red-400" } as const;

function situacaoDe(p: Projeto, pesquisa: Pesquisa | undefined, media: number | null) {
  if (!pesquisa) return p.status === "concluido" ? "aguardando" : "em_andamento";
  const nps = pesquisa.nps;
  if ((media != null && media < 3) || (nps != null && nps <= 6)) return "insatisfeito";
  if ((media != null && media < 4) || (nps != null && nps <= 8)) return "neutro";
  return "satisfeito";
}

function SucessoPage() {
  const [loading, setLoading] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [cs, setCs] = useState<ProjectCS[]>([]);
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pesquisar, setPesquisar] = useState<Projeto | null>(null);

  const carregar = useCallback(async () => {
    const [p, c, pq] = await Promise.all([
      supabase.from("projects").select("id, nome, cliente, status").order("nome"),
      supabase.from("project_cs").select("*"),
      supabase
        .from("project_cs_pesquisas")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (tabelaAusente(pq.error) || tabelaAusente(c.error)) {
      setIndisponivel(true);
      setLoading(false);
      return;
    }
    if (p.error || pq.error) toast.error("Não foi possível carregar a satisfação dos clientes.");
    setProjetos((p.data as Projeto[]) ?? []);
    setCs((c.data as ProjectCS[]) ?? []);
    setPesquisas((pq.data as Pesquisa[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Uma linha por projeto, com a pesquisa mais recente do cliente. */
  const linhas = useMemo<Linha[]>(
    () =>
      projetos
        .filter((p) => p.status !== "pausado" || pesquisas.some((x) => x.project_id === p.id))
        .map((p) => {
          const pesquisa = pesquisas.find((x) => x.project_id === p.id);
          const media = pesquisa ? mediaPesquisa(pesquisa) : null;
          return {
            ...p,
            pesquisa,
            media,
            nps: pesquisa?.nps ?? null,
            situacao: situacaoDe(p, pesquisa, media) as Situacao,
          };
        })
        .sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome)),
    [projetos, pesquisas],
  );

  const avaliados = linhas.filter((l) => l.pesquisa);
  const aguardando = linhas.filter((l) => l.situacao === "aguardando");
  const insatisfeitos = linhas.filter((l) => l.situacao === "insatisfeito");

  const satisfacao = useMemo(() => {
    const medias = avaliados.map((l) => l.media).filter((m): m is number => m != null);
    if (!medias.length) return null;
    return {
      media: medias.reduce((a, b) => a + b, 0) / medias.length,
      satisfeitos: medias.filter((m) => m >= 4).length,
      total: medias.length,
    };
  }, [avaliados]);

  const nps = calcularNps(avaliados.map((l) => l.nps).filter((n): n is number => n != null));

  /** Média de cada tema na pesquisa mais recente de cada cliente. */
  const temas = useMemo(() => {
    return TEMAS.map((t) => {
      const ns = avaliados
        .flatMap((l) => t.chaves.map((k) => l.pesquisa![k]))
        .filter((n): n is number => n != null);
      return {
        label: t.label,
        media: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null,
      };
    }).filter((t): t is { label: string; media: number } => t.media != null);
  }, [avaliados]);

  /** Últimos comentários dos clientes (feedback aberto das pesquisas). */
  const comentarios = useMemo(
    () =>
      pesquisas
        .filter((p) => p.funcionou_bem || p.melhorar || p.sugestoes)
        .slice(0, 5)
        .map((p) => ({ ...p, projeto: projetos.find((x) => x.id === p.project_id)?.nome ?? "—" })),
    [pesquisas, projetos],
  );

  const visiveis = linhas.filter((l) =>
    filtro === "todos"
      ? true
      : filtro === "aguardando"
        ? l.situacao === "aguardando"
        : l.situacao === "insatisfeito",
  );

  return (
    <div className="space-y-6" data-testid="sucesso-page">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sucesso do Cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Como cada cliente avaliou o projeto entregue pela DPlay.
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : indisponivel ? (
        <Card className="rounded-xl border-dashed border-border bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <HeartHandshake className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Sucesso do Cliente ainda não ativado</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Esta página passa a funcionar assim que a atualização do banco do CRM for aplicada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Três números: quão satisfeitos, se recomendariam, e quantos já foram ouvidos */}
          <div className="grid gap-3 sm:grid-cols-3" data-testid="cs-indicadores">
            <Numero
              titulo="Satisfação média"
              valor={
                satisfacao ? (
                  <>
                    <span aria-hidden>{escalaDe(satisfacao.media).emoji}</span>{" "}
                    {formatarMedia(satisfacao.media)}
                    <span className="text-sm font-normal text-muted-foreground"> de 5</span>
                  </>
                ) : (
                  "—"
                )
              }
              sub={
                satisfacao
                  ? `${satisfacao.satisfeitos} de ${satisfacao.total} clientes satisfeitos`
                  : "Nenhuma pesquisa registrada ainda"
              }
            />
            <Numero
              titulo="Recomendariam a DPlay (NPS)"
              valor={nps.valor ?? "—"}
              sub={
                nps.total
                  ? `${nps.promotores} sim · ${nps.neutros} neutro${nps.neutros === 1 ? "" : "s"} · ${nps.detratores} não`
                  : "Nota de 1 a 10 dada na pesquisa"
              }
              barra={nps.total ? nps : undefined}
            />
            <Numero
              titulo="Clientes ouvidos"
              valor={
                <>
                  {avaliados.length}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    de {avaliados.length + aguardando.length}
                  </span>
                </>
              }
              sub={
                aguardando.length
                  ? `${aguardando.length} projeto${aguardando.length === 1 ? "" : "s"} entregue${aguardando.length === 1 ? "" : "s"} sem pesquisa`
                  : "Todos os projetos entregues foram avaliados"
              }
              onClick={aguardando.length ? () => setFiltro("aguardando") : undefined}
            />
          </div>

          {/* Lista de projetos */}
          <section className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar projetos">
              {(
                [
                  ["todos", `Todos (${linhas.length})`],
                  ["aguardando", `Aguardando pesquisa (${aguardando.length})`],
                  ["insatisfeito", `Insatisfeitos (${insatisfeitos.length})`],
                ] as [Filtro, string][]
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f}
                  onClick={() => setFiltro(f)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                    filtro === f
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "text-muted-foreground ring-border hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Card className="rounded-xl border-border bg-card">
              <CardContent className="p-0">
                {visiveis.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {filtro === "aguardando"
                      ? "Todos os projetos entregues já têm pesquisa. 🎉"
                      : filtro === "insatisfeito"
                        ? "Nenhum cliente insatisfeito. 🎉"
                        : "Nenhum projeto cadastrado."}
                  </p>
                ) : (
                  <>
                    <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_110px_150px] gap-4 border-b border-border px-5 py-2.5 text-xs text-muted-foreground md:grid">
                      <span>Projeto</span>
                      <span>Satisfação</span>
                      <span>Recomendação</span>
                      <span>Avaliado em</span>
                      <span />
                    </div>
                    <ul className="divide-y divide-border" data-testid="cs-lista">
                      {visiveis.map((l) => {
                        const meta = SITUACAO_META[l.situacao];
                        return (
                          <li
                            key={l.id}
                            className="grid items-center gap-x-4 gap-y-2 px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_110px_150px]"
                          >
                            <div className="min-w-0">
                              <Link
                                to="/projetos/$id"
                                params={{ id: l.id }}
                                search={{ aba: "sucesso" }}
                                className="block truncate text-sm font-semibold hover:underline"
                              >
                                {l.nome}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">
                                {[
                                  l.cliente && l.cliente !== l.nome ? l.cliente : null,
                                  STATUS_LABEL[l.status] ?? l.status,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              {meta.emoji && (
                                <span className="text-lg" aria-hidden>
                                  {meta.emoji}
                                </span>
                              )}
                              <span>
                                {l.media != null && (
                                  <span className="font-semibold">{formatarMedia(l.media)} </span>
                                )}
                                <span className={cn("text-xs", meta.classe)}>{meta.label}</span>
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-xs text-muted-foreground md:hidden">
                                Recomendação:{" "}
                              </span>
                              {l.nps != null ? (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                                    NPS_META[npsCategoria(l.nps)].classe,
                                  )}
                                >
                                  {l.nps} de 10
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="md:hidden">Avaliado em: </span>
                              {l.pesquisa ? formatarData(l.pesquisa.data) : "—"}
                            </p>
                            <div className="md:text-right">
                              {!l.pesquisa ? (
                                <Button
                                  size="sm"
                                  variant={l.situacao === "aguardando" ? "default" : "ghost"}
                                  className="gap-1.5"
                                  onClick={() => setPesquisar(l)}
                                >
                                  <ClipboardCheck className="size-4" /> Registrar pesquisa
                                </Button>
                              ) : (
                                <Link
                                  to="/projetos/$id"
                                  params={{ id: l.id }}
                                  search={{ aba: "sucesso" }}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Ver respostas <ChevronRight className="size-3.5" />
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          {/* O que os clientes disseram e onde melhorar: só aparece quando há pesquisas */}
          {avaliados.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-xl border-border bg-card" data-testid="cs-comentarios">
                <CardContent className="space-y-3 p-5">
                  <h2 className="text-base font-semibold">O que os clientes disseram</h2>
                  {comentarios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum comentário registrado nas pesquisas.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {comentarios.map((c) => (
                        <li key={c.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                          <p className="mb-1 text-xs text-muted-foreground">
                            {c.projeto} · {formatarData(c.data)}
                          </p>
                          {c.funcionou_bem && <p>👍 {c.funcionou_bem}</p>}
                          {c.melhorar && <p>🔧 {c.melhorar}</p>}
                          {c.sugestoes && <p>💡 {c.sugestoes}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border bg-card" data-testid="cs-temas">
                <CardContent className="space-y-3 p-5">
                  <h2 className="text-base font-semibold">Notas por tema</h2>
                  <ul className="space-y-2.5">
                    {temas.map((t) => (
                      <li
                        key={t.label}
                        className="grid grid-cols-[140px_minmax(0,1fr)_40px] items-center gap-3"
                      >
                        <span className="truncate text-sm">{t.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", BARRA[tomMedia(t.media)])}
                            style={{ width: `${(t.media / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-right text-sm font-medium">
                          {formatarMedia(t.media)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {pesquisar && (
        <PesquisaDialog
          tipo={pesquisar.status === "concluido" ? "raf" : "coleta"}
          projectId={pesquisar.id}
          farolAtual={cs.find((c) => c.project_id === pesquisar.id)?.farol ?? null}
          onClose={() => setPesquisar(null)}
          onSaved={async ({ proximoContato, farol }) => {
            const id = pesquisar.id;
            setPesquisar(null);
            const patch: Partial<ProjectCS> = {};
            if (proximoContato) patch.proximo_contato = proximoContato;
            if (farol) patch.farol = farol;
            if (Object.keys(patch).length) {
              const { error } = await supabase
                .from("project_cs")
                .upsert({ project_id: id, ...patch }, { onConflict: "project_id" });
              if (error) toast.error("Pesquisa salva, mas não foi possível atualizar o farol.");
            }
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Numero({
  titulo,
  valor,
  sub,
  barra,
  onClick,
}: {
  titulo: string;
  valor: React.ReactNode;
  sub: string;
  barra?: { promotores: number; neutros: number; detratores: number; total: number };
  onClick?: () => void;
}) {
  const conteudo = (
    <CardContent className="p-5">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{valor}</p>
      {barra && (
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span
            className={NPS_META.promotor.barra}
            style={{ width: `${(barra.promotores / barra.total) * 100}%` }}
          />
          <span
            className={NPS_META.neutro.barra}
            style={{ width: `${(barra.neutros / barra.total) * 100}%` }}
          />
          <span
            className={NPS_META.detrator.barra}
            style={{ width: `${(barra.detratores / barra.total) * 100}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </CardContent>
  );
  const cls = cn(
    "h-full rounded-xl border-border bg-card text-left transition",
    onClick && "hover:border-primary/40",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block h-full w-full">
      <Card className={cls}>{conteudo}</Card>
    </button>
  ) : (
    <Card className={cls}>{conteudo}</Card>
  );
}
