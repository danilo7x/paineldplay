import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, HeartHandshake, Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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
  TOM_CLASSE,
  diasAte,
  formatarData,
  notaTom,
  tabelaAusente,
  textoProximoContato,
  type Farol,
  type Indicacao,
  type IndicacaoStatus,
  type ProjectCS,
  type Registro,
} from "@/features/sucesso/meta";

export const Route = createFileRoute("/_authenticated/sucesso")({
  component: SucessoPage,
});

type Projeto = { id: string; nome: string; cliente: string | null; status: string };
type Linha = Projeto & {
  farol: Farol | null;
  motivo: string | null;
  responsavel: string | null;
  proximo: string | null;
  ultimoContato: string | null;
  nps: number | null;
  csat: number | null;
  atrasado: boolean;
  prioridade: number;
};
type Filtro = "atencao" | "todos" | Farol | "sem";

const ATIVOS = new Set(["em_desenvolvimento", "em_manutencao"]);

function SucessoPage() {
  const [loading, setLoading] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [cs, setCs] = useState<ProjectCS[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [filtro, setFiltro] = useState<Filtro>("atencao");
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, c, r, i, pf] = await Promise.all([
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

  const linhas = useMemo<Linha[]>(() => {
    const porProjeto = new Map(cs.map((c) => [c.project_id, c]));
    return projetos
      .filter((p) => incluirInativos || ATIVOS.has(p.status))
      .map((p) => {
        const c = porProjeto.get(p.id);
        const regs = registros.filter((r) => r.project_id === p.id);
        const ultimoContato =
          regs.find((r) => r.tipo === "contato" || r.tipo === "reuniao")?.data ?? null;
        const nps = regs.find((r) => r.tipo === "nps")?.nota ?? null;
        const csat = regs.find((r) => r.tipo === "csat")?.nota ?? null;
        const proximo = c?.proximo_contato ?? null;
        const atrasado = proximo ? diasAte(proximo) < 0 : false;
        const farol = c?.farol ?? null;
        const prioridade =
          farol === "vermelho" ? 0 : atrasado ? 1 : farol === "amarelo" ? 2 : farol == null ? 3 : 4;
        return {
          ...p,
          farol,
          motivo: c?.farol_motivo ?? null,
          responsavel: c?.responsavel_id ? (nomes.get(c.responsavel_id) ?? null) : null,
          proximo,
          ultimoContato,
          nps,
          csat,
          atrasado,
          prioridade,
        };
      })
      .sort((a, b) => a.prioridade - b.prioridade || a.nome.localeCompare(b.nome));
  }, [projetos, cs, registros, nomes, incluirInativos]);

  const contagem = useMemo(() => {
    const n = { verde: 0, amarelo: 0, vermelho: 0, sem: 0, atrasados: 0, atencao: 0 };
    for (const l of linhas) {
      if (l.farol) n[l.farol]++;
      else n.sem++;
      if (l.atrasado) n.atrasados++;
      if (l.prioridade <= 2) n.atencao++;
    }
    return n;
  }, [linhas]);

  const npsMedio = useMemo(() => {
    const notas = linhas.map((l) => l.nps).filter((x): x is number => x != null);
    return notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
  }, [linhas]);

  const visiveis = linhas.filter((l) => {
    if (busca && !`${l.nome} ${l.cliente ?? ""}`.toLowerCase().includes(busca.toLowerCase()))
      return false;
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
          Quem precisa de atenção, quando é o próximo contato e o que os clientes acham da DPlay.
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
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <ResumoCard
              titulo="Precisam de atenção"
              valor={contagem.atencao}
              ativo={filtro === "atencao"}
              onClick={() => setFiltro("atencao")}
              destaque
            />
            <ResumoCard
              titulo="Vermelho"
              valor={contagem.vermelho}
              dot={FAROL_META.vermelho.dot}
              ativo={filtro === "vermelho"}
              onClick={() => setFiltro("vermelho")}
            />
            <ResumoCard
              titulo="Amarelo"
              valor={contagem.amarelo}
              dot={FAROL_META.amarelo.dot}
              ativo={filtro === "amarelo"}
              onClick={() => setFiltro("amarelo")}
            />
            <ResumoCard
              titulo="Verde"
              valor={contagem.verde}
              dot={FAROL_META.verde.dot}
              ativo={filtro === "verde"}
              onClick={() => setFiltro("verde")}
            />
            <ResumoCard
              titulo="NPS médio"
              valor={npsMedio ?? "—"}
              sub={`${contagem.atrasados} contato${contagem.atrasados === 1 ? "" : "s"} atrasado${contagem.atrasados === 1 ? "" : "s"}`}
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
                ["atencao", "Precisam de atenção"],
                ["todos", "Todos"],
                ["sem", `Sem farol (${contagem.sem})`],
              ] as [Filtro, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                aria-pressed={filtro === f}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                  filtro === f
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-card/60 text-muted-foreground ring-border/50 hover:text-foreground",
                )}
              >
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
                <p className="py-14 text-center text-sm text-muted-foreground">
                  {filtro === "atencao"
                    ? "Nenhum projeto precisando de atenção. 🎉"
                    : "Nenhum projeto neste filtro."}
                </p>
              ) : (
                <ul className="divide-y divide-border/40" data-testid="cs-lista">
                  {visiveis.map((l) => (
                    <li key={l.id}>
                      <Link
                        to="/projetos/$id"
                        params={{ id: l.id }}
                        search={{ aba: "sucesso" }}
                        className="grid items-center gap-3 px-5 py-4 transition hover:bg-background/40 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_130px_150px_110px_20px]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "size-3 shrink-0 rounded-full",
                              l.farol ? FAROL_META[l.farol].dot : "bg-muted-foreground/30",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{l.nome}</p>
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
                        <p className="text-xs text-muted-foreground">
                          <span className="md:hidden">Último contato: </span>
                          {l.ultimoContato ? formatarData(l.ultimoContato) : "Sem contato"}
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
                        <div className="flex gap-1.5">
                          {l.nps != null && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                TOM_CLASSE[notaTom("nps", l.nps)!],
                              )}
                            >
                              NPS {l.nps}
                            </span>
                          )}
                          {l.csat != null && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                TOM_CLASSE[notaTom("csat", l.csat)!],
                              )}
                            >
                              CSAT {l.csat}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="hidden size-4 text-muted-foreground md:block" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Indicações */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              Indicações ({indicacoes.length})
            </h2>
            {indicacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma indicação ainda. Elas são registradas na aba “Sucesso do cliente” de cada
                projeto.
              </p>
            ) : (
              <Card className="rounded-xl border-border bg-card/50">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/40">
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
  dot,
  ativo,
  destaque,
  onClick,
}: {
  titulo: string;
  valor: number | string;
  sub?: string;
  dot?: string;
  ativo?: boolean;
  destaque?: boolean;
  onClick?: () => void;
}) {
  const Conteudo = (
    <CardContent className="p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {dot && <span className={cn("size-2 rounded-full", dot)} />}
        {titulo}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight",
          destaque && Number(valor) > 0 && "text-red-300",
        )}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </CardContent>
  );
  const cls = cn(
    "rounded-xl border-border bg-card text-left transition",
    onClick && "hover:border-primary/40",
    ativo && "border-primary/60 ring-1 ring-primary/40",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full">
      <Card className={cls}>{Conteudo}</Card>
    </button>
  ) : (
    <Card className={cls}>{Conteudo}</Card>
  );
}
