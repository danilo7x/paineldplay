import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, HeartHandshake, Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FAROL_META,
  INDICACAO_META,
  INDICACAO_STATUS,
  diasAte,
  formatarData,
  tabelaAusente,
  textoProximoContato,
  type Farol,
  type Indicacao,
  type IndicacaoStatus,
  type ProjectCS,
  type Registro,
} from "@/features/sucesso/meta";
import {
  INTERESSES,
  NPS_META,
  PLANO_INDICACOES,
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
/** A pesquisa padrão é a da reunião final: projeto concluído sem ela fica pendente. */
type Pendencia = "raf" | null;
type Linha = Projeto & {
  ativo: boolean;
  farol: Farol | null;
  motivo: string | null;
  responsavel: string | null;
  proximo: string | null;
  media: number | null;
  nps: number | null;
  ultimaPesquisa: Pesquisa | undefined;
  pendencia: Pendencia;
  insatisfeito: boolean;
  atrasado: boolean;
  prioridade: number;
};
type Filtro = "atencao" | "pendentes" | "todos" | Farol | "sem";

const ATIVOS = new Set(["em_desenvolvimento", "em_manutencao"]);
const BARRA = { bom: "bg-emerald-400", medio: "bg-amber-400", ruim: "bg-red-400" } as const;

function SucessoPage() {
  const [loading, setLoading] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [semPesquisas, setSemPesquisas] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [cs, setCs] = useState<ProjectCS[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [filtro, setFiltro] = useState<Filtro>("atencao");
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, c, r, i, pf, pq] = await Promise.all([
        supabase.from("projects").select("id, nome, cliente, status").order("nome"),
        supabase.from("project_cs").select("*"),
        supabase
          .from("project_cs_registros")
          .select("*")
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("project_cs_indicacoes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, nome"),
        supabase
          .from("project_cs_pesquisas")
          .select("*")
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (tabelaAusente(c.error) || tabelaAusente(r.error) || tabelaAusente(i.error)) {
        setIndisponivel(true);
        setLoading(false);
        return;
      }
      if (p.error || c.error || r.error || i.error)
        toast.error("Não foi possível carregar o Sucesso do Cliente.");
      setProjetos((p.data as Projeto[]) ?? []);
      setCs((c.data as ProjectCS[]) ?? []);
      setRegistros((r.data as Registro[]) ?? []);
      setIndicacoes((i.data as Indicacao[]) ?? []);
      setSemPesquisas(tabelaAusente(pq.error));
      setPesquisas((pq.data as Pesquisa[] | null) ?? []);
      setNomes(
        new Map(
          ((pf.data as { id: string; nome: string | null }[]) ?? []).map((x) => [
            x.id,
            x.nome ?? "—",
          ]),
        ),
      );
      setLoading(false);
    })();
  }, []);

  /** Uma linha por projeto, com o resultado da pesquisa mais recente. */
  const todas = useMemo<Linha[]>(() => {
    const porProjeto = new Map(cs.map((c) => [c.project_id, c]));
    return projetos
      .map((p) => {
        const c = porProjeto.get(p.id);
        const pqs = pesquisas.filter((x) => x.project_id === p.id);
        const ultimaPesquisa = pqs[0];
        const regs = registros.filter((r) => r.project_id === p.id);
        const media = ultimaPesquisa ? mediaPesquisa(ultimaPesquisa) : null;
        // Registros antigos de NPS valem até a primeira pesquisa guiada.
        const nps = ultimaPesquisa?.nps ?? regs.find((r) => r.tipo === "nps")?.nota ?? null;
        const ativo = ATIVOS.has(p.status);
        const pendencia: Pendencia =
          !semPesquisas && p.status === "concluido" && !pqs.some((x) => x.tipo === "raf")
            ? "raf"
            : null;
        const proximo = c?.proximo_contato ?? null;
        const atrasado = proximo ? diasAte(proximo) < 0 : false;
        const farol = c?.farol ?? null;
        const insatisfeito = (media != null && media < 3) || (nps != null && nps <= 6);
        const prioridade =
          farol === "vermelho"
            ? 0
            : insatisfeito || atrasado
              ? 1
              : farol === "amarelo"
                ? 2
                : farol == null
                  ? 3
                  : 4;
        return {
          ...p,
          ativo,
          farol,
          motivo: c?.farol_motivo ?? null,
          responsavel: c?.responsavel_id ? (nomes.get(c.responsavel_id) ?? null) : null,
          proximo,
          media,
          nps,
          ultimaPesquisa,
          pendencia,
          insatisfeito,
          atrasado,
          prioridade,
        };
      })
      .sort((a, b) => a.prioridade - b.prioridade || a.nome.localeCompare(b.nome));
  }, [projetos, cs, registros, pesquisas, nomes, semPesquisas]);

  /** Carteira considerada nos indicadores: projetos ativos (ou todos, se marcado). */
  const carteira = useMemo(
    () => todas.filter((l) => incluirInativos || l.ativo),
    [todas, incluirInativos],
  );

  const contagem = useMemo(() => {
    const n = { verde: 0, amarelo: 0, vermelho: 0, sem: 0, atencao: 0 };
    for (const l of carteira) {
      if (l.farol) n[l.farol]++;
      else n.sem++;
      if (l.prioridade <= 2) n.atencao++;
    }
    return n;
  }, [carteira]);

  const pendentes = useMemo(() => todas.filter((l) => l.pendencia).length, [todas]);

  // A pesquisa acontece no encerramento, então os indicadores de satisfação contam
  // todos os projetos avaliados (inclusive concluídos), e não só os ativos.
  const nps = useMemo(
    () => calcularNps(todas.map((l) => l.nps).filter((x): x is number => x != null)),
    [todas],
  );

  const satisfacao = useMemo(() => {
    const medias = todas.map((l) => l.media).filter((x): x is number => x != null);
    if (!medias.length) return null;
    return {
      media: medias.reduce((a, b) => a + b, 0) / medias.length,
      satisfeitos: medias.filter((m) => m >= 4).length,
      total: medias.length,
    };
  }, [todas]);

  /** Média de cada tema na pesquisa mais recente de cada projeto avaliado. */
  const temas = useMemo(() => {
    const ultimas = todas.map((l) => l.ultimaPesquisa).filter((x): x is Pesquisa => !!x);
    return TEMAS.map((t) => {
      const ns = ultimas
        .flatMap((p) => t.chaves.map((k) => p[k]))
        .filter((n): n is number => n != null);
      return {
        label: t.label,
        media: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null,
        n: ns.length,
      };
    }).filter((t) => t.media != null) as { label: string; media: number; n: number }[];
  }, [todas]);
  const piorTema = temas.length > 1 ? temas.reduce((a, b) => (b.media < a.media ? b : a)) : null;

  /** Interesse em outras soluções, levantado no alinhamento final. */
  const oportunidades = useMemo(() => {
    const vistos = new Set<string>();
    const lista: { projeto: string; projectId: string; interesses: string[]; data: string }[] = [];
    for (const p of pesquisas) {
      if (p.tipo !== "raf" || vistos.has(p.project_id)) continue;
      vistos.add(p.project_id);
      if (!p.interesses.length) continue;
      const projeto = projetos.find((x) => x.id === p.project_id);
      if (!projeto) continue;
      lista.push({
        projeto: projeto.nome,
        projectId: projeto.id,
        interesses: p.interesses.map((i) => INTERESSES.find((x) => x.chave === i)?.label ?? i),
        data: p.data,
      });
    }
    return lista;
  }, [pesquisas, projetos]);

  /** Plano de Indicações por cliente. */
  const planoPorProjeto = useMemo(() => {
    const m = new Map<string, { ativas: number; fechadas: number }>();
    for (const x of indicacoes) {
      const v = m.get(x.project_id) ?? { ativas: 0, fechadas: 0 };
      if (x.status !== "perdida") v.ativas++;
      if (x.status === "fechada") v.fechadas++;
      m.set(x.project_id, v);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, nome: projetos.find((p) => p.id === id)?.nome ?? "—", ...v }))
      .sort((a, b) => b.ativas - a.ativas);
  }, [indicacoes, projetos]);

  const visiveis = todas.filter((l) => {
    if (busca && !`${l.nome} ${l.cliente ?? ""}`.toLowerCase().includes(busca.toLowerCase()))
      return false;
    // Pendências mostram também projetos concluídos (o RAF acontece no encerramento).
    if (filtro === "pendentes") return l.pendencia != null;
    if (!incluirInativos && !l.ativo) return false;
    if (filtro === "todos") return true;
    if (filtro === "atencao") return l.prioridade <= 2;
    if (filtro === "sem") return l.farol == null;
    return l.farol === filtro;
  });

  const nomeProjeto = useMemo(() => new Map(projetos.map((p) => [p.id, p.nome])), [projetos]);

  async function mudarStatusIndicacao(id: string, status: IndicacaoStatus) {
    const { error } = await supabase.from("project_cs_indicacoes").update({ status }).eq("id", id);
    if (error) return toast.error("Não foi possível atualizar a indicação.");
    setIndicacoes((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  return (
    <div className="space-y-6" data-testid="sucesso-page">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sucesso do Cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Satisfação e recomendação dos clientes, quem precisa de atenção e quais pesquisas faltam.
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : indisponivel ? (
        <Card className="rounded-xl border-dashed border-border bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <HeartHandshake className="size-5" />
            </div>
            <p className="text-sm font-medium">Sucesso do Cliente ainda não ativado</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Esta página passa a funcionar assim que a atualização do banco do CRM for aplicada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Indicadores da carteira */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="cs-indicadores">
            <ResumoCard
              titulo="Precisam de atenção"
              valor={contagem.atencao}
              sub="Farol vermelho/amarelo, nota baixa ou contato atrasado"
              ativo={filtro === "atencao"}
              onClick={() => setFiltro("atencao")}
              destaque
            />
            <ResumoCard
              titulo="NPS dos clientes"
              valor={nps.valor ?? "—"}
              sub={
                nps.total
                  ? `${nps.promotores} recomendaria${nps.promotores === 1 ? "" : "m"} · ${nps.neutros} neutro${nps.neutros === 1 ? "" : "s"} · ${nps.detratores} não`
                  : "Sem pesquisas ainda"
              }
              barra={nps.total ? nps : undefined}
            />
            <ResumoCard
              titulo="Satisfação média"
              valor={
                satisfacao
                  ? `${escalaDe(satisfacao.media).emoji} ${formatarMedia(satisfacao.media)}`
                  : "—"
              }
              sub={
                satisfacao
                  ? `${satisfacao.satisfeitos} de ${satisfacao.total} clientes satisfeitos (4 ou 5)`
                  : "Sem pesquisas ainda"
              }
            />
            <ResumoCard
              titulo="Pesquisa final pendente"
              valor={semPesquisas ? "—" : pendentes}
              sub={
                semPesquisas
                  ? "Aguardando atualização do banco"
                  : "Projetos concluídos sem a pesquisa da reunião final"
              }
              ativo={filtro === "pendentes"}
              onClick={semPesquisas ? undefined : () => setFiltro("pendentes")}
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar projeto ou cliente"
                className="pl-9"
              />
            </div>
            {(
              [
                ["atencao", "Precisam de atenção", null],
                ["pendentes", `Pesquisa final pendente (${pendentes})`, null],
                ["todos", "Todos", null],
                ["vermelho", `${contagem.vermelho}`, FAROL_META.vermelho.dot],
                ["amarelo", `${contagem.amarelo}`, FAROL_META.amarelo.dot],
                ["verde", `${contagem.verde}`, FAROL_META.verde.dot],
                ["sem", `Sem farol (${contagem.sem})`, null],
              ] as [Filtro, string, string | null][]
            )
              .filter(([f]) => f !== "pendentes" || !semPesquisas)
              .map(([f, label, dot]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  aria-pressed={filtro === f}
                  aria-label={dot ? `Farol ${FAROL_META[f as Farol].label}: ${label}` : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                    filtro === f
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-card/60 text-muted-foreground ring-border hover:text-foreground",
                  )}
                >
                  {dot && <span className={cn("size-2 rounded-full", dot)} />}
                  {label}
                </button>
              ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={incluirInativos}
                onChange={(e) => setIncluirInativos(e.target.checked)}
                className="accent-primary"
              />
              Incluir concluídos e pausados
            </label>
          </div>

          {/* Projetos */}
          <Card className="rounded-xl border-border bg-card/50">
            <CardContent className="p-0">
              {visiveis.length === 0 ? (
                <div className="space-y-3 py-14 text-center text-sm text-muted-foreground">
                  {filtro === "atencao" && contagem.sem > 0 ? (
                    <>
                      {/* Sem farol não é "tudo certo": ainda falta avaliar esses projetos. */}
                      <p>
                        Nada urgente agora, mas{" "}
                        {contagem.sem === 1
                          ? "1 projeto ainda não tem farol"
                          : `${contagem.sem} projetos ainda não têm farol`}
                        .
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setFiltro("sem")}>
                        Definir farol
                      </Button>
                    </>
                  ) : (
                    <p>
                      {filtro === "atencao"
                        ? "Nenhum projeto precisando de atenção. 🎉"
                        : filtro === "pendentes"
                          ? "Todos os projetos concluídos já têm a pesquisa final. 🎉"
                          : "Nenhum projeto neste filtro."}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_110px_110px_150px_20px] gap-3 border-b border-border px-5 py-2 text-xs text-muted-foreground md:grid">
                    <span>Projeto</span>
                    <span>Responsável CS</span>
                    <span>Satisfação</span>
                    <span>Recomendação</span>
                    <span>Próximo contato</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-border" data-testid="cs-lista">
                    {visiveis.map((l) => (
                      <li key={l.id}>
                        <Link
                          to="/projetos/$id"
                          params={{ id: l.id }}
                          search={{ aba: "sucesso" }}
                          className="grid items-center gap-x-3 gap-y-1.5 px-5 py-4 transition hover:bg-background/40 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_110px_110px_150px_20px]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                "size-3 shrink-0 rounded-full",
                                l.farol ? FAROL_META[l.farol].dot : "bg-muted-foreground/30",
                              )}
                            />
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                <span className="truncate">{l.nome}</span>
                                {l.pendencia && (
                                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                                    Pesquisa final pendente
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {l.motivo ??
                                  (l.cliente && l.cliente !== l.nome ? l.cliente : null) ??
                                  (l.farol ? FAROL_META[l.farol].hint : "Farol não definido")}
                              </p>
                            </div>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="md:hidden">CS: </span>
                            {l.responsavel ?? "Sem responsável"}
                          </p>
                          <p className="text-sm">
                            <span className="text-xs text-muted-foreground md:hidden">
                              Satisfação:{" "}
                            </span>
                            {l.media != null ? (
                              <span title={escalaDe(l.media).label}>
                                {escalaDe(l.media).emoji}{" "}
                                <span className="font-medium">{formatarMedia(l.media)}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </p>
                          <p>
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
                                {l.nps}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </p>
                          <p
                            className={cn(
                              "text-xs",
                              l.atrasado ? "font-medium text-red-300" : "text-muted-foreground",
                            )}
                          >
                            <span className="md:hidden">Próximo: </span>
                            {l.proximo
                              ? `${formatarData(l.proximo)} · ${textoProximoContato(l.proximo)}`
                              : "Não agendado"}
                          </p>
                          <ChevronRight className="hidden size-4 text-muted-foreground md:block" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* Onde a DPlay vai bem e onde melhorar + oportunidades */}
          {!semPesquisas && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-xl border-border bg-card/50" data-testid="cs-temas">
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h2 className="text-base font-semibold">Satisfação por tema</h2>
                    <p className="text-xs text-muted-foreground">
                      Média da pesquisa mais recente de cada cliente avaliado.
                    </p>
                  </div>
                  {temas.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Aparece aqui depois da primeira pesquisa de satisfação.
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {temas.map((t) => (
                        <li
                          key={t.label}
                          className="grid grid-cols-[140px_minmax(0,1fr)_56px] items-center gap-3"
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
                  )}
                  {piorTema && piorTema.media < 4 && (
                    <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                      Ponto de atenção:{" "}
                      <strong className="text-foreground">{piorTema.label}</strong> tem a menor nota
                      ({formatarMedia(piorTema.media)} de 5).
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border bg-card/50" data-testid="cs-oportunidades">
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h2 className="text-base font-semibold">Vamos continuar juntos?</h2>
                    <p className="text-xs text-muted-foreground">
                      Interesse em outras soluções, levantado no alinhamento final.
                    </p>
                  </div>
                  {oportunidades.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhum interesse registrado nos alinhamentos finais.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {oportunidades.map((o) => (
                        <li key={o.projectId} className="py-2.5">
                          <Link
                            to="/projetos/$id"
                            params={{ id: o.projectId }}
                            search={{ aba: "sucesso" }}
                            className="text-sm font-medium hover:underline"
                          >
                            {o.projeto}
                          </Link>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {o.interesses.map((i) => (
                              <span
                                key={i}
                                className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {i}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Indicações */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Indicações ({indicacoes.length})</h2>
              <p className="text-xs text-muted-foreground">
                Plano de Indicações: a cada {PLANO_INDICACOES.leadsParaDesconto},{" "}
                {PLANO_INDICACOES.descricaoDesconto}; 1 fechada, {PLANO_INDICACOES.descricaoFechada}
                .
              </p>
            </div>
            {planoPorProjeto.length > 0 && (
              <div className="flex flex-wrap gap-2" data-testid="cs-plano">
                {planoPorProjeto.map((p) => {
                  const rumo = p.ativas % PLANO_INDICACOES.leadsParaDesconto;
                  const ganhos = Math.floor(p.ativas / PLANO_INDICACOES.leadsParaDesconto);
                  return (
                    <div
                      key={p.id}
                      className="min-w-[180px] rounded-lg border border-border bg-card/50 px-3 py-2"
                    >
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      <div className="mt-1.5 grid grid-cols-5 gap-1">
                        {Array.from({ length: PLANO_INDICACOES.leadsParaDesconto }, (_, n) => (
                          <span
                            key={n}
                            className={cn(
                              "h-1.5 rounded-full",
                              n < rumo ? "bg-primary" : "bg-muted",
                            )}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rumo} de {PLANO_INDICACOES.leadsParaDesconto}
                        {ganhos > 0 && ` · ${ganhos} desconto${ganhos > 1 ? "s" : ""}`}
                        {p.fechadas > 0 && ` · ${p.fechadas} fechada${p.fechadas > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            {indicacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma indicação ainda. Elas são registradas na aba “Sucesso do cliente” de cada
                projeto.
              </p>
            ) : (
              <Card className="rounded-xl border-border bg-card/50">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {indicacoes.map((x) => (
                      <li
                        key={x.id}
                        className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{x.empresa}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[x.contato, x.telefone].filter(Boolean).join(" · ") || "Sem contato"}
                          </p>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          Indicada por {nomeProjeto.get(x.project_id) ?? "—"}
                        </p>
                        <Select
                          value={x.status}
                          onValueChange={(v) => mudarStatusIndicacao(x.id, v as IndicacaoStatus)}
                        >
                          <SelectTrigger
                            className={cn("h-8 text-xs", INDICACAO_META[x.status].chip)}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INDICACAO_STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {INDICACAO_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ResumoCard({
  titulo,
  valor,
  sub,
  ativo,
  destaque,
  barra,
  onClick,
}: {
  titulo: string;
  valor: number | string;
  sub?: string;
  ativo?: boolean;
  destaque?: boolean;
  barra?: { promotores: number; neutros: number; detratores: number; total: number };
  onClick?: () => void;
}) {
  const Conteudo = (
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight",
          destaque && Number(valor) > 0 && "text-red-300",
        )}
      >
        {valor}
      </p>
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
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </CardContent>
  );
  const cls = cn(
    "h-full rounded-xl border-border bg-card text-left transition",
    onClick && "hover:border-primary/40",
    ativo && "border-primary/60 ring-1 ring-primary/40",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block h-full w-full">
      <Card className={cls}>{Conteudo}</Card>
    </button>
  ) : (
    <Card className={cls}>{Conteudo}</Card>
  );
}
