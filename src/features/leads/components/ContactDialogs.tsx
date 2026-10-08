import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCommercialPeople } from "../api";
import { CALL_RESULTS, type CallResult } from "../model";
import { CALL_SCRIPT } from "../script";
import {
  RESPONSE_OUTCOMES,
  addNote,
  registerCall,
  registerResponse,
  setNextAction,
  type ResponseOutcome,
} from "../workflow";
import { ChannelSelect, DateTimeField, DialogActions, type LeadDialogProps } from "./dialog-kit";
import { useLeadRun } from "./useLeadRun";
import { fromDateInput, fromLocalInput, toLocalInput } from "../format";

type BaseProps = LeadDialogProps;

/* ------------------------------------------------------------------ */

export function CallDialog({
  lead,
  open,
  onOpenChange,
  userId,
  pendingCallbackId,
}: BaseProps & { pendingCallbackId: string | null }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const first = !lead.data_primeiro_contato;
  const cadenceActive = lead.cadencia_status === "ativa";
  // A cadência é para quem ainda não conversou; mais adiante no funil, uma
  // ligação não atendida não deve devolver o lead para o 1º template.
  const canOfferCadence =
    !cadenceActive &&
    !lead.nao_contatar &&
    ["novo", "primeiro_contato", "cadencia"].includes(lead.etapa);
  const [at, setAt] = useState("");
  const [resultado, setResultado] = useState<CallResult>("atendeu");
  const [obs, setObs] = useState("");
  const [necessidade, setNecessidade] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingLocal, setMeetingLocal] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [startCadence, setStartCadence] = useState(true);
  const [nextText, setNextText] = useState("");
  const [nextAt, setNextAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setAt(toLocalInput(new Date()));
    setResultado("atendeu");
    setObs("");
    setNecessidade(lead.necessidade_inicial ?? "");
    setMeetingAt("");
    setMeetingLocal("");
    setCallbackAt("");
    setStartCadence(canOfferCadence);
    setNextText("");
    setNextAt("");
  }, [open, lead, canOfferCadence]);

  const needsMeeting = resultado === "reuniao_marcada";
  const needsCallback = resultado === "pediu_retorno";
  const showNext = resultado === "atendeu" || resultado === "respondeu_whatsapp";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{first ? "Registrar primeira ligação" : "Registrar ligação"}</DialogTitle>
          <DialogDescription>
            {pendingCallbackId
              ? "Esta ligação cumpre o retorno previsto."
              : "Data, resultado e observações do contato."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <details className="group rounded-xl border border-border/60 bg-background/40 p-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-primary">
              <BookOpenText className="size-3.5" /> Roteiro de ligação (apoio)
            </summary>
            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
              {CALL_SCRIPT.map((sec, i) => (
                <div key={sec.title}>
                  <p className="text-xs font-semibold">
                    {i + 1}. {sec.title}
                  </p>
                  {sec.lines.map((l) => (
                    <p
                      key={l}
                      className="mt-1 border-l-2 border-primary/50 pl-2 text-xs text-muted-foreground"
                    >
                      {l}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </details>
          <div className="grid gap-3 sm:grid-cols-2">
            <DateTimeField label="Data e hora" value={at} onChange={setAt} />
            <div className="grid gap-1.5">
              <Label>Resultado</Label>
              <Select value={resultado} onValueChange={(v) => setResultado(v as CallResult)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_RESULTS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsMeeting && (
            <div className="grid gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 sm:grid-cols-2">
              <DateTimeField
                label="Reunião de diagnóstico *"
                value={meetingAt}
                onChange={setMeetingAt}
              />
              <div className="grid gap-1.5">
                <Label>Local ou link</Label>
                <Input value={meetingLocal} onChange={(e) => setMeetingLocal(e.target.value)} />
              </div>
            </div>
          )}

          {needsCallback && (
            <DateTimeField label="Retornar em *" value={callbackAt} onChange={setCallbackAt} />
          )}

          {resultado === "nao_atendeu" &&
            (cadenceActive || !["novo", "primeiro_contato", "cadencia"].includes(lead.etapa) ? (
              <p className="text-xs text-muted-foreground">
                {cadenceActive
                  ? "A cadência de WhatsApp já está em andamento."
                  : "Registre uma nova tentativa na próxima ação."}
              </p>
            ) : lead.nao_contatar ? (
              <p className="text-xs text-amber-400">
                O lead pediu para não receber novos contatos.
              </p>
            ) : (
              <label className="flex items-start gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 text-sm">
                <Checkbox
                  checked={startCadence}
                  onCheckedChange={(v) => setStartCadence(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Iniciar a cadência de WhatsApp
                  <span className="block text-[11px] text-muted-foreground">
                    O 1º template fica previsto para agora; os seguintes são lembrados em dias
                    úteis.
                  </span>
                </span>
              </label>
            ))}

          {showNext && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1.5">
                <Label>Próxima ação</Label>
                <Input
                  value={nextText}
                  onChange={(e) => setNextText(e.target.value)}
                  placeholder={
                    resultado === "atendeu"
                      ? "Definir o próximo passo com o lead"
                      : "Dar continuidade à conversa"
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Até</Label>
                <Input type="date" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Necessidade percebida</Label>
            <Textarea
              rows={2}
              value={necessidade}
              onChange={(e) => setNecessidade(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          disabled={(needsMeeting && !meetingAt) || (needsCallback && !callbackAt)}
          onConfirm={() =>
            run(
              () =>
                registerCall(
                  lead,
                  {
                    at: fromLocalInput(at) ?? new Date(),
                    resultado,
                    observacoes: obs,
                    necessidade:
                      necessidade.trim() !== (lead.necessidade_inicial ?? "")
                        ? necessidade.trim()
                        : undefined,
                    meetingAt: fromLocalInput(meetingAt) ?? undefined,
                    meetingLocal,
                    callbackAt: fromLocalInput(callbackAt) ?? undefined,
                    startCadence,
                    nextText: nextText.trim() || undefined,
                    nextAt: fromDateInput(nextAt) ?? undefined,
                    pendingCallbackId,
                  },
                  { userId, now: new Date() },
                ),
              "Ligação registrada",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function ResponseDialog({ lead, open, onOpenChange, userId }: BaseProps) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [at, setAt] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [resumo, setResumo] = useState("");
  const [desfecho, setDesfecho] = useState<ResponseOutcome>("interesse");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingLocal, setMeetingLocal] = useState("");
  const [nextText, setNextText] = useState("");
  const [nextAt, setNextAt] = useState("");
  useEffect(() => {
    if (!open) return;
    setAt(toLocalInput(new Date()));
    setCanal("whatsapp");
    setResumo("");
    setDesfecho("interesse");
    setMeetingAt("");
    setMeetingLocal("");
    setNextText("");
    setNextAt("");
  }, [open]);

  const closes = desfecho === "sem_interesse" || desfecho === "optout";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar resposta do lead</DialogTitle>
          <DialogDescription>
            As ações pendentes (como as mensagens da cadência) são interrompidas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <DateTimeField label="Respondeu em" value={at} onChange={setAt} />
            <ChannelSelect value={canal} onChange={setCanal} />
          </div>
          <div className="grid gap-1.5">
            <Label>Desfecho</Label>
            <Select value={desfecho} onValueChange={(v) => setDesfecho(v as ResponseOutcome)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {closes && (
              <p className="text-[11px] text-amber-400">
                O lead será encerrado como “Perdido”
                {desfecho === "optout" ? " e marcado para não receber novos contatos" : ""}.
              </p>
            )}
          </div>
          {desfecho === "interesse" && (
            <div className="grid gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 sm:grid-cols-2">
              <DateTimeField
                label="Marcar reunião de diagnóstico"
                value={meetingAt}
                onChange={setMeetingAt}
              />
              <div className="grid gap-1.5">
                <Label>Local ou link</Label>
                <Input value={meetingLocal} onChange={(e) => setMeetingLocal(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Sem data, a próxima ação fica “Marcar a reunião de diagnóstico”.
              </p>
            </div>
          )}
          {!closes && !(desfecho === "interesse" && meetingAt) && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1.5">
                <Label>Próxima ação</Label>
                <Input
                  value={nextText}
                  onChange={(e) => setNextText(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Até</Label>
                <Input type="date" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>O que o lead disse</Label>
            <Textarea rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          onConfirm={() =>
            run(
              () =>
                registerResponse(
                  lead,
                  {
                    at: fromLocalInput(at) ?? new Date(),
                    canal,
                    resumo,
                    desfecho,
                    meetingAt: fromLocalInput(meetingAt) ?? undefined,
                    meetingLocal,
                    nextText: nextText.trim() || undefined,
                    nextAt: fromDateInput(nextAt) ?? undefined,
                  },
                  { userId, now: new Date() },
                ),
              "Resposta registrada",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function NextActionDialog({
  lead,
  open,
  onOpenChange,
  userId,
  isAdmin,
}: BaseProps & { isAdmin: boolean }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const { data: people = [], isLoading: loadingPeople } = useCommercialPeople();
  const [texto, setTexto] = useState("");
  const [data, setData] = useState("");
  const [resp, setResp] = useState("");
  // Responsável fora da lista (ex.: conta oculta) aparece como "definir depois".
  const respChoice = resp && (loadingPeople || people.some((p) => p.id === resp)) ? resp : "none";
  useEffect(() => {
    if (!open) return;
    setTexto(lead.proximo_passo ?? "");
    setData(lead.data_lembrete ?? "");
    setResp(lead.proxima_acao_responsavel_id ?? lead.responsavel_id ?? userId);
  }, [open, lead, userId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Próxima ação</DialogTitle>
          <DialogDescription>O que deve ser feito, por quem e até quando.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>O que fazer</Label>
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Até quando</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Por quem</Label>
              {isAdmin ? (
                <Select value={respChoice} onValueChange={(v) => setResp(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— definir depois —</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome ?? p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value="Você" disabled />
              )}
            </div>
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          label="Salvar"
          onConfirm={() =>
            run(() => {
              // Texto e data andam juntos: sem um deles, o Kanban e a Agenda divergem.
              if (!!texto.trim() !== !!data)
                throw new Error(texto.trim() ? "Informe até quando." : "Informe o que fazer.");
              return setNextAction({
                texto: texto.trim(),
                data: data || null,
                responsavelId: isAdmin ? (respChoice === "none" ? null : respChoice) : userId,
              });
            }, "Próxima ação atualizada")
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const NOTE_TYPES = [
  { value: "nota", label: "Nota interna" },
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "Mensagem de WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "reuniao", label: "Reunião" },
];

export function NoteDialog({ lead, open, onOpenChange }: BaseProps) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [tipo, setTipo] = useState("nota");
  const [titulo, setTitulo] = useState("");
  const [obs, setObs] = useState("");
  const [at, setAt] = useState("");
  useEffect(() => {
    if (!open) return;
    setTipo("nota");
    setTitulo("");
    setObs("");
    setAt(toLocalInput(new Date()));
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar atividade</DialogTitle>
          <DialogDescription>
            Contatos avulsos e anotações entram na linha do tempo como realizados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateTimeField label="Quando" value={at} onChange={setAt} />
          </div>
          <div className="grid gap-1.5">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Detalhes</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          disabled={!titulo.trim()}
          onConfirm={() =>
            run(
              () =>
                addNote({
                  tipo,
                  titulo: titulo.trim(),
                  observacoes: obs,
                  at: fromLocalInput(at) ?? new Date(),
                  canal: tipo === "whatsapp" ? "whatsapp" : tipo === "email" ? "email" : null,
                }),
              "Atividade registrada",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}
