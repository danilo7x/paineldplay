import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  HeartHandshake,
  Loader2,
  MessageSquarePlus,
  Plus,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FAROIS,
  FAROL_META,
  INDICACAO_META,
  INDICACAO_STATUS,
  REGISTRO_META,
  TOM_CLASSE,
  formatarData,
  hojeISO,
  notaTom,
  tabelaAusente,
  textoProximoContato,
  diasAte,
  type Farol,
  type Indicacao,
  type IndicacaoStatus,
  type ProjectCS,
  type Registro,
  type RegistroTipo,
} from "./meta";

type Pessoa = { id: string; nome: string | null };

type Props = {
  projectId: string;
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId: string;
};

/** Aba "Sucesso do cliente" do projeto: farol, próximo contato, registros e indicações. */
export function SucessoTab({ projectId, canEdit, isAdmin, currentUserId }: Props) {
  const [loading, setLoading] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [cs, setCs] = useState<ProjectCS | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [motivo, setMotivo] = useState("");
  const [novoRegistro, setNovoRegistro] = useState<RegistroTipo | null>(null);
  const [novaIndicacao, setNovaIndicacao] = useState(false);

  const carregar = useCallback(async () => {
    const [c, r, i, p] = await Promise.all([
      supabase.from("project_cs").select("*").eq("project_id", projectId).maybeSingle(),
      supabase
        .from("project_cs_registros")
        .select("*")
        .eq("project_id", projectId)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("project_cs_indicacoes")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    if (tabelaAusente(c.error) || tabelaAusente(r.error) || tabelaAusente(i.error)) {
      setIndisponivel(true);
      setLoading(false);
      return;
    }
    if (c.error || r.error || i.error)
      toast.error("Não foi possível carregar o Sucesso do Cliente.");
    const atual = (c.data as ProjectCS | null) ?? null;
    setCs(atual);
    setMotivo(atual?.farol_motivo ?? "");
    setRegistros((r.data as Registro[]) ?? []);
    setIndicacoes((i.data as Indicacao[]) ?? []);
    setPessoas(((p.data as Pessoa[]) ?? []).filter((x) => x.nome));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nomes = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nome ?? "—"])), [pessoas]);

  async function salvarCS(
    patch: Partial<Omit<ProjectCS, "project_id" | "updated_at">>,
    aviso?: string,
  ) {
    const anterior = cs;
    setCs((old) => ({
      ...(old ?? {
        project_id: projectId,
        farol: null,
        farol_motivo: null,
        responsavel_id: null,
        proximo_contato: null,
        updated_at: "",
      }),
      ...patch,
    }));
    const { error } = await supabase
      .from("project_cs")
      .upsert({ project_id: projectId, ...patch }, { onConflict: "project_id" });
    if (error) {
      setCs(anterior);
      toast.error("Não foi possível salvar.");
      return false;
    }
    if (aviso) toast.success(aviso);
    return true;
  }

  async function excluirRegistro(id: string) {
    const { error } = await supabase.from("project_cs_registros").delete().eq("id", id);
    if (error) return toast.error("Não foi possível excluir.");
    setRegistros((rs) => rs.filter((r) => r.id !== id));
  }

  async function mudarStatusIndicacao(id: string, status: IndicacaoStatus) {
    const { error } = await supabase.from("project_cs_indicacoes").update({ status }).eq("id", id);
    if (error) return toast.error("Não foi possível atualizar a indicação.");
    setIndicacoes((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function excluirIndicacao(id: string) {
    const { error } = await supabase.from("project_cs_indicacoes").delete().eq("id", id);
    if (error) return toast.error("Não foi possível excluir.");
    setIndicacoes((xs) => xs.filter((x) => x.id !== id));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (indisponivel) {
    return (
      <Card className="rounded-xl border-dashed border-border bg-card/40">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <HeartHandshake className="size-5" />
          </div>
          <p className="text-sm font-medium">Sucesso do Cliente ainda não ativado</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Esta aba passa a funcionar assim que a atualização do banco do CRM for aplicada.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ultimo = (tipo: RegistroTipo) => registros.find((r) => r.tipo === tipo);
  const ultimoContato = registros.find((r) => r.tipo === "contato" || r.tipo === "reuniao");
  const nps = ultimo("nps");
  const csat = ultimo("csat");
  const proximo = cs?.proximo_contato ?? null;
  const atrasado = proximo ? diasAte(proximo) < 0 : false;

  return (
    <div className="space-y-4" data-testid="sucesso-tab">
      {/* Saúde do projeto */}
      <Card className="rounded-xl border-border bg-card">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Saúde do projeto
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Como o cliente está hoje?</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Resumo
                titulo="Último contato"
                valor={ultimoContato ? formatarData(ultimoContato.data) : "—"}
              />
              <Resumo
                titulo="NPS"
                valor={nps ? String(nps.nota) : "—"}
                tom={nps ? notaTom("nps", nps.nota) : null}
              />
              <Resumo
                titulo="CSAT"
                valor={csat ? `${csat.nota}/5` : "—"}
                tom={csat ? notaTom("csat", csat.nota) : null}
              />
            </div>
          </div>

          <div
            className="grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Farol do projeto"
          >
            {FAROIS.map((f) => {
              const ativo = cs?.farol === f;
              const meta = FAROL_META[f];
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  disabled={!canEdit}
                  onClick={() =>
                    !ativo && salvarCS({ farol: f }, `Farol: ${meta.label.toLowerCase()}`)
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-background/30 px-4 py-3 text-left transition disabled:cursor-not-allowed",
                    ativo ? cn("ring-2", meta.ring) : "hover:border-border hover:bg-background/50",
                  )}
                >
                  <span className={cn("size-3 shrink-0 rounded-full", meta.dot)} />
                  <span>
                    <span className="block text-sm font-semibold">{meta.label}</span>
                    <span className="block text-xs text-muted-foreground">{meta.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_200px]">
            <div className="space-y-1.5">
              <Label htmlFor="cs-motivo" className="text-xs text-muted-foreground">
                Motivo do farol
              </Label>
              <Textarea
                id="cs-motivo"
                rows={2}
                placeholder="Ex.: cliente satisfeito com a última entrega"
                value={motivo}
                disabled={!canEdit}
                onChange={(e) => setMotivo(e.target.value)}
                onBlur={() => {
                  if ((cs?.farol_motivo ?? "") !== motivo.trim())
                    salvarCS({ farol_motivo: motivo.trim() || null }, "Motivo salvo");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Responsável CS</Label>
              <Select
                value={cs?.responsavel_id ?? "none"}
                disabled={!canEdit}
                onValueChange={(v) =>
                  salvarCS({ responsavel_id: v === "none" ? null : v }, "Responsável salvo")
                }
              >
                <SelectTrigger aria-label="Responsável CS">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {pessoas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-proximo" className="text-xs text-muted-foreground">
                Próximo contato
              </Label>
              <Input
                id="cs-proximo"
                type="date"
                value={proximo ?? ""}
                disabled={!canEdit}
                onChange={(e) =>
                  salvarCS({ proximo_contato: e.target.value || null }, "Próximo contato salvo")
                }
                className={cn(atrasado && "border-red-500/50 text-red-300")}
              />
              {proximo && (
                <p className={cn("text-xs", atrasado ? "text-red-300" : "text-muted-foreground")}>
                  {textoProximoContato(proximo)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registrar */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REGISTRO_META) as RegistroTipo[]).map((t) => (
            <Button
              key={t}
              variant="outline"
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => setNovoRegistro(t)}
            >
              <MessageSquarePlus className="size-4" /> {REGISTRO_META[t].acao}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Histórico */}
        <Card className="rounded-xl border-border bg-card/50">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold">
              Histórico
            </h3>
            {registros.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum contato ou pesquisa registrado ainda.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" data-testid="cs-historico">
                {registros.map((r) => {
                  const tom = notaTom(r.tipo, r.nota);
                  return (
                    <li
                      key={r.id}
                      className="group flex gap-3 rounded-xl border border-border bg-background/30 p-3"
                    >
                      <div className="w-16 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {formatarData(r.data)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                            {REGISTRO_META[r.tipo].label}
                          </span>
                          {r.nota != null && tom && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                TOM_CLASSE[tom],
                              )}
                            >
                              {r.tipo === "csat" ? `${r.nota}/5` : `${r.nota}/10`}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {nomes.get(r.autor_id ?? "") ?? ""}
                          </span>
                        </div>
                        {r.comentario && (
                          <p className="mt-1 whitespace-pre-wrap text-sm">{r.comentario}</p>
                        )}
                      </div>
                      {(isAdmin || r.autor_id === currentUserId) && (
                        <button
                          type="button"
                          aria-label="Excluir registro"
                          onClick={() => excluirRegistro(r.id)}
                          className="self-start text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Indicações */}
        <Card className="rounded-xl border-border bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">
                Indicações
              </h3>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1"
                  onClick={() => setNovaIndicacao(true)}
                >
                  <Plus className="size-4" /> Nova
                </Button>
              )}
            </div>
            {indicacoes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Cliente satisfeito indicou alguém? Anote aqui.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {indicacoes.map((x) => (
                  <li
                    key={x.id}
                    className="group rounded-xl border border-border bg-background/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{x.empresa}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[x.contato, x.telefone].filter(Boolean).join(" · ") || "Sem contato"}
                        </p>
                      </div>
                      {(isAdmin || x.autor_id === currentUserId) && (
                        <button
                          type="button"
                          aria-label="Excluir indicação"
                          onClick={() => excluirIndicacao(x.id)}
                          className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <Select
                      value={x.status}
                      disabled={!canEdit}
                      onValueChange={(v) => mudarStatusIndicacao(x.id, v as IndicacaoStatus)}
                    >
                      <SelectTrigger className="mt-2 h-8 w-full text-xs">
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
            )}
          </CardContent>
        </Card>
      </div>

      <NovoRegistroDialog
        tipo={novoRegistro}
        projectId={projectId}
        onClose={() => setNovoRegistro(null)}
        onSaved={async (proximoContato) => {
          setNovoRegistro(null);
          if (proximoContato) await salvarCS({ proximo_contato: proximoContato });
          carregar();
        }}
      />
      <NovaIndicacaoDialog
        open={novaIndicacao}
        projectId={projectId}
        onClose={() => setNovaIndicacao(false)}
        onSaved={() => {
          setNovaIndicacao(false);
          carregar();
        }}
      />
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: string;
  tom?: "bom" | "medio" | "ruim" | null;
}) {
  return (
    <div
      className={cn(
        "rounded-full px-3 py-1 ring-1 ring-border/50",
        tom ? TOM_CLASSE[tom] : "bg-background/40",
      )}
    >
      <span className="text-muted-foreground">{titulo}: </span>
      <span className="font-semibold">{valor}</span>
    </div>
  );
}

function NovoRegistroDialog({
  tipo,
  projectId,
  onClose,
  onSaved,
}: {
  tipo: RegistroTipo | null;
  projectId: string;
  onClose: () => void;
  onSaved: (proximoContato: string | null) => void;
}) {
  const [data, setData] = useState(hojeISO());
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [proximo, setProximo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (tipo) {
      setData(hojeISO());
      setNota(null);
      setComentario("");
      setProximo("");
    }
  }, [tipo]);

  if (!tipo) return null;
  const comNota = tipo === "nps" || tipo === "csat";
  const escala = tipo === "nps" ? Array.from({ length: 11 }, (_, i) => i) : [1, 2, 3, 4, 5];

  async function salvar() {
    if (!tipo) return;
    if (comNota && nota == null) return toast.error("Escolha a nota.");
    if (!comNota && !comentario.trim()) return toast.error("Escreva um resumo do contato.");
    setSalvando(true);
    const { error } = await supabase.from("project_cs_registros").insert({
      project_id: projectId,
      tipo,
      data,
      nota: comNota ? nota : null,
      comentario: comentario.trim() || null,
    });
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar o registro.");
    toast.success(`${REGISTRO_META[tipo].label} registrado`);
    onSaved(proximo || null);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{REGISTRO_META[tipo].acao}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-data">Data</Label>
            <Input
              id="reg-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          {comNota && (
            <div className="space-y-1.5">
              <Label>
                {tipo === "nps"
                  ? "De 0 a 10, quanto recomendaria a DPlay?"
                  : "De 1 a 5, qual a satisfação com a entrega?"}
              </Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Nota">
                {escala.map((n) => {
                  const tom = notaTom(tipo, n);
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={nota === n}
                      onClick={() => setNota(n)}
                      className={cn(
                        "size-9 rounded-lg border border-border text-sm font-semibold transition hover:border-primary/50",
                        nota === n && tom && cn("border-transparent", TOM_CLASSE[tom]),
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reg-comentario">{comNota ? "Comentário (opcional)" : "Resumo"}</Label>
            <Textarea
              id="reg-comentario"
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={comNota ? "O que o cliente disse?" : "Sobre o que conversaram?"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-proximo" className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" /> Próximo contato (opcional)
            </Label>
            <Input
              id="reg-proximo"
              type="date"
              value={proximo}
              onChange={(e) => setProximo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaIndicacaoDialog({
  open,
  projectId,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empresa, setEmpresa] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setEmpresa("");
      setContato("");
      setTelefone("");
      setObs("");
    }
  }, [open]);

  async function salvar() {
    if (!empresa.trim()) return toast.error("Informe a empresa indicada.");
    setSalvando(true);
    const { error } = await supabase.from("project_cs_indicacoes").insert({
      project_id: projectId,
      empresa: empresa.trim(),
      contato: contato.trim() || null,
      telefone: telefone.trim() || null,
      observacoes: obs.trim() || null,
    });
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar a indicação.");
    toast.success("Indicação registrada");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova indicação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ind-empresa">Empresa indicada</Label>
            <Input
              id="ind-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ind-contato">Contato</Label>
              <Input
                id="ind-contato"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ind-telefone">Telefone</Label>
              <Input
                id="ind-telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ind-obs">Observações</Label>
            <Textarea id="ind-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
