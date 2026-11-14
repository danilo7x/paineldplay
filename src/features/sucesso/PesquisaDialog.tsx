import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Gift, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FAROL_META, hojeISO, type Farol } from "./meta";
import {
  ESCALA,
  INTERESSES,
  NPS_META,
  PESQUISA_META,
  PLANO_INDICACOES,
  farolSugerido,
  formatarMedia,
  npsCategoria,
  type Interesse,
  type PerguntaChave,
  type PesquisaTipo,
} from "./pesquisa";

type Props = {
  tipo: PesquisaTipo | null;
  projectId: string;
  farolAtual: Farol | null;
  onClose: () => void;
  onSaved: (extra: { proximoContato: string | null; farol: Farol | null }) => void;
};

/** Formulário guiado, na mesma ordem dos slides da reunião. */
export function PesquisaDialog({ tipo, projectId, farolAtual, onClose, onSaved }: Props) {
  const [data, setData] = useState(hojeISO());
  const [respostas, setRespostas] = useState<Partial<Record<PerguntaChave, number>>>({});
  const [nps, setNps] = useState<number | null>(null);
  const [funcionou, setFuncionou] = useState("");
  const [melhorar, setMelhorar] = useState("");
  const [sugestoes, setSugestoes] = useState("");
  const [meses, setMeses] = useState("");
  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [proximo, setProximo] = useState("");
  const [atualizarFarol, setAtualizarFarol] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!tipo) return;
    setData(hojeISO());
    setRespostas({});
    setNps(null);
    setFuncionou("");
    setMelhorar("");
    setSugestoes("");
    setMeses("");
    setInteresses([]);
    setProximo("");
    setAtualizarFarol(true);
  }, [tipo]);

  const perguntas = useMemo(() => (tipo ? PESQUISA_META[tipo].perguntas : []), [tipo]);
  const respondidas = perguntas.filter((p) => respostas[p.chave] != null).length;
  const media = useMemo(() => {
    const ns = perguntas.map((p) => respostas[p.chave]).filter((n): n is number => n != null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  }, [perguntas, respostas]);
  const sugerido = farolSugerido(media, nps);
  const mudaFarol = sugerido != null && sugerido !== farolAtual;

  if (!tipo) return null;
  const meta = PESQUISA_META[tipo];

  async function salvar() {
    if (!tipo) return;
    if (respondidas < perguntas.length) return toast.error("Responda todas as perguntas de 1 a 5.");
    if (nps == null) return toast.error("Escolha a nota de recomendação (1 a 10).");
    const mesesNum = meses.trim() === "" ? null : Number(meses);
    if (mesesNum != null && (!Number.isInteger(mesesNum) || mesesNum < 0 || mesesNum > 36))
      return toast.error("Meses de acompanhamento: use um número de 0 a 36.");
    setSalvando(true);
    const { error } = await supabase.from("project_cs_pesquisas").insert({
      project_id: projectId,
      tipo,
      data,
      ...respostas,
      nps,
      funcionou_bem: funcionou.trim() || null,
      melhorar: melhorar.trim() || null,
      sugestoes: sugestoes.trim() || null,
      meses_acompanhamento: tipo === "raf" ? mesesNum : null,
      interesses: tipo === "raf" ? interesses : [],
    });
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar a pesquisa.");
    toast.success(`${meta.titulo} registrada`);
    onSaved({
      proximoContato: proximo || null,
      farol: mudaFarol && atualizarFarol ? sugerido : null,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{meta.titulo}</DialogTitle>
          <DialogDescription>
            Faça as perguntas na ordem da apresentação e marque a resposta do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6" data-testid="pesquisa-form">
          <div className="max-w-[200px] space-y-1.5">
            <Label htmlFor="pq-data">Data da reunião</Label>
            <Input
              id="pq-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          {/* 1) Avaliação de satisfação */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Qual o grau de satisfação com…</h3>
              <span className="text-xs text-muted-foreground">
                {respondidas}/{perguntas.length}
              </span>
            </div>
            <ul className="space-y-2">
              {perguntas.map((p) => {
                const atual = respostas[p.chave];
                return (
                  <li
                    key={p.chave}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.texto}</p>
                      <p
                        className={cn(
                          "text-xs",
                          atual ? ESCALA[atual - 1].cor : "text-muted-foreground",
                        )}
                      >
                        {atual ? ESCALA[atual - 1].label : "Sem resposta"}
                      </p>
                    </div>
                    <div className="flex gap-1" role="radiogroup" aria-label={p.texto}>
                      {ESCALA.map((e) => (
                        <button
                          key={e.nota}
                          type="button"
                          role="radio"
                          aria-checked={atual === e.nota}
                          aria-label={e.label}
                          title={e.label}
                          onClick={() => setRespostas((r) => ({ ...r, [p.chave]: e.nota }))}
                          className={cn(
                            "grid size-10 place-items-center rounded-lg text-xl ring-1 ring-border transition hover:bg-accent",
                            atual === e.nota ? cn("ring-2", e.ativo) : atual ? "opacity-40" : "",
                          )}
                        >
                          {e.emoji}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 2) Recomendação */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              De 1 a 10, o quanto recomendaria a DPlay para uma empresa parceira?
            </h3>
            <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Recomendação">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const cat = npsCategoria(n);
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={nps === n}
                    onClick={() => setNps(n)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-semibold ring-1 ring-border transition hover:bg-accent",
                      nps === n && cn("ring-0", NPS_META[cat].classe),
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-10 gap-1 text-[11px] text-muted-foreground">
              <span className="col-span-6 border-t-2 border-red-400/60 pt-1 text-center">
                Não recomendaria
              </span>
              <span className="col-span-2 border-t-2 border-amber-400/60 pt-1 text-center">
                Neutro
              </span>
              <span className="col-span-2 border-t-2 border-emerald-400/60 pt-1 text-center">
                Recomendaria
              </span>
            </div>
          </section>

          {/* 3) RAF: auditoria e próximas soluções */}
          {tipo === "raf" && (
            <section className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="pq-meses">Meses de acompanhamento</Label>
                <Input
                  id="pq-meses"
                  type="number"
                  min={0}
                  max={36}
                  inputMode="numeric"
                  placeholder="Ex.: 3"
                  value={meses}
                  onChange={(e) => setMeses(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Período de auditoria combinado.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Vamos continuar juntos? Interesse em:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESSES.map((i) => {
                    const ativo = interesses.includes(i.chave);
                    return (
                      <button
                        key={i.chave}
                        type="button"
                        aria-pressed={ativo}
                        title={i.hint}
                        onClick={() =>
                          setInteresses((xs) =>
                            ativo ? xs.filter((x) => x !== i.chave) : [...xs, i.chave],
                          )
                        }
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                          ativo
                            ? "bg-primary text-primary-foreground ring-primary"
                            : "text-muted-foreground ring-border hover:text-foreground",
                        )}
                      >
                        {i.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* 4) Feedback aberto */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Feedback aberto</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pq-bem" className="text-xs">
                  O que funcionou bem?
                </Label>
                <Textarea
                  id="pq-bem"
                  rows={3}
                  value={funcionou}
                  onChange={(e) => setFuncionou(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pq-melhorar" className="text-xs">
                  O que podemos melhorar?
                </Label>
                <Textarea
                  id="pq-melhorar"
                  rows={3}
                  value={melhorar}
                  onChange={(e) => setMelhorar(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pq-sugestoes" className="text-xs">
                  Sugestões para os próximos passos
                </Label>
                <Textarea
                  id="pq-sugestoes"
                  rows={3}
                  value={sugestoes}
                  onChange={(e) => setSugestoes(e.target.value)}
                />
              </div>
            </div>
          </section>

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Gift className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Lembre o <strong className="text-foreground">Plano de Indicações</strong>: a cada{" "}
              {PLANO_INDICACOES.leadsParaDesconto} indicações, {PLANO_INDICACOES.descricaoDesconto};
              se 1 indicação fechar, {PLANO_INDICACOES.descricaoFechada}. Registre as indicações no
              card “Indicações” do projeto.
            </span>
          </p>

          {/* Resultado e próximos passos */}
          <section className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">Resultado</p>
              <p>
                Satisfação: <strong>{media != null ? `${formatarMedia(media)} de 5` : "—"}</strong>
                {" · "}Recomendação: <strong>{nps ?? "—"}</strong>
              </p>
              {mudaFarol && sugerido && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={atualizarFarol}
                    onChange={(e) => setAtualizarFarol(e.target.checked)}
                  />
                  <span className="flex items-center gap-1.5">
                    Atualizar farol para
                    <span className={cn("size-2 rounded-full", FAROL_META[sugerido].dot)} />
                    <strong>{FAROL_META[sugerido].label}</strong>
                  </span>
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pq-proximo" className="flex items-center gap-1.5 text-xs">
                <CalendarClock className="size-3.5" /> Próximo contato (opcional)
              </Label>
              <Input
                id="pq-proximo"
                type="date"
                value={proximo}
                onChange={(e) => setProximo(e.target.value)}
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar pesquisa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
