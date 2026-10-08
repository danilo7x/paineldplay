import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

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
import { supabase } from "@/integrations/supabase/client";
import { useLeadActivities } from "../api";
import { ACTIVE_STAGES, FINAL_STAGES, STAGE_META, type FinalStage, type LeadStage } from "../model";
import {
  closeLead,
  registerDecision,
  registerMeetingOutcome,
  registerMilestone,
  registerRescheduleAttempt,
  reopenLead,
  scheduleMeeting,
  type Decision,
  type MeetingOutcome,
  type Milestone,
  type MilestoneValues,
  type WorkflowCtx,
} from "../workflow";
import { ChannelSelect, DateTimeField, DialogActions, type LeadDialogProps } from "./dialog-kit";
import { useLeadRun } from "./useLeadRun";
import { fromLocalInput, toLocalInput } from "../format";

type BaseProps = LeadDialogProps;

function ctxFor(userId: string): WorkflowCtx {
  return { userId, now: new Date() };
}

/* ------------------------------------------------------------------ */

export function ScheduleMeetingDialog({
  lead,
  open,
  onOpenChange,
  userId,
  reagendamento,
}: BaseProps & { reagendamento?: boolean }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [at, setAt] = useState("");
  const [local, setLocal] = useState("");
  const [obs, setObs] = useState("");
  useEffect(() => {
    if (open) {
      setAt(reagendamento ? "" : toLocalInput(lead.reuniao_em));
      setLocal(lead.reuniao_local ?? "");
      setObs("");
    }
  }, [open, lead, reagendamento]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reagendamento ? "Reagendar reunião de diagnóstico" : "Marcar reunião de diagnóstico"}
          </DialogTitle>
          <DialogDescription>
            Ações pendentes (como mensagens da cadência) deixam de valer e a próxima ação passa a
            ser a reunião.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <DateTimeField label="Data e hora *" value={at} onChange={setAt} />
          <div className="grid gap-1.5">
            <Label>Local ou link</Label>
            <Input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Google Meet, endereço…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          disabled={!at}
          error={error}
          label={reagendamento ? "Reagendar" : "Marcar reunião"}
          onConfirm={() =>
            run(
              () => {
                const d = fromLocalInput(at);
                if (!d) throw new Error("Informe a data da reunião");
                return scheduleMeeting(
                  lead,
                  { at: d, local, observacoes: obs, reagendamento },
                  ctxFor(userId),
                );
              },
              reagendamento ? "Reunião reagendada" : "Reunião marcada",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function MeetingOutcomeDialog({
  lead,
  open,
  onOpenChange,
  userId,
  pendingId,
  initial,
}: BaseProps & { pendingId: string | null; initial?: MeetingOutcome }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [outcome, setOutcome] = useState<MeetingOutcome>("realizada");
  const [at, setAt] = useState("");
  const [obs, setObs] = useState("");
  const [necessidade, setNecessidade] = useState("");
  useEffect(() => {
    if (open) {
      setOutcome(initial ?? "realizada");
      setAt(toLocalInput(lead.reuniao_em ?? new Date()));
      setObs("");
      setNecessidade(lead.necessidade_identificada ?? "");
    }
  }, [open, lead, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado da reunião de diagnóstico</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>O que aconteceu?</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as MeetingOutcome)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realizada">Reunião realizada</SelectItem>
                <SelectItem value="no_show">Lead não compareceu (no-show)</SelectItem>
                <SelectItem value="cancelada">Reunião cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DateTimeField label="Data e hora" value={at} onChange={setAt} />
          {outcome === "realizada" && (
            <div className="grid gap-1.5">
              <Label>Necessidade identificada</Label>
              <Textarea
                rows={3}
                value={necessidade}
                onChange={(e) => setNecessidade(e.target.value)}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          {outcome === "no_show" && (
            <p className="text-xs text-muted-foreground">
              Fica prevista a ação “Enviar template de no-show e tentar reagendar”.
            </p>
          )}
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          onConfirm={() =>
            run(
              () =>
                registerMeetingOutcome(
                  lead,
                  pendingId,
                  { outcome, at: fromLocalInput(at) ?? new Date(), observacoes: obs, necessidade },
                  ctxFor(userId),
                ),
              outcome === "realizada"
                ? "Diagnóstico realizado"
                : outcome === "no_show"
                  ? "No-show registrado"
                  : "Cancelamento registrado",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function RescheduleAttemptDialog({
  lead,
  open,
  onOpenChange,
  userId,
  pendingId,
}: BaseProps & { pendingId: string | null }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [at, setAt] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [obs, setObs] = useState("");
  useEffect(() => {
    if (open) {
      setAt(toLocalInput(new Date()));
      setCanal("whatsapp");
      setObs("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tentativa de reagendamento</DialogTitle>
          <DialogDescription>
            Registre que o template de no-show foi enviado. Quando o lead confirmar o novo horário,
            use “Reagendar reunião”.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <DateTimeField label="Enviado em" value={at} onChange={setAt} />
          <ChannelSelect value={canal} onChange={setCanal} />
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          onConfirm={() =>
            run(
              () =>
                registerRescheduleAttempt(
                  lead,
                  pendingId,
                  { at: fromLocalInput(at) ?? new Date(), canal, observacoes: obs },
                  ctxFor(userId),
                ),
              "Tentativa registrada",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function MilestoneDialog({
  lead,
  open,
  onOpenChange,
  userId,
  milestone,
  pendingId,
}: BaseProps & { milestone: Milestone | null; pendingId: string | null }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [at, setAt] = useState("");
  const [obs, setObs] = useState("");
  const [values, setValues] = useState<MilestoneValues>({});
  useEffect(() => {
    if (!open || !milestone) return;
    setAt(toLocalInput(new Date()));
    setObs("");
    const v: MilestoneValues = {};
    for (const f of milestone.fields ?? []) {
      const cur = lead[f.name];
      if (cur == null) continue;
      v[f.name] = f.kind === "datetime" ? toLocalInput(String(cur)) : String(cur);
    }
    setValues(v);
  }, [open, milestone, lead]);

  if (!milestone) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{milestone.label}</DialogTitle>
          <DialogDescription>Próxima ação sugerida: {milestone.next.text}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {(milestone.fields ?? []).map((f) => (
            <div key={f.name} className="grid gap-1.5">
              <Label>
                {f.label}
                {f.required && " *"}
              </Label>
              {f.kind === "textarea" ? (
                <Textarea
                  rows={3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              ) : (
                <Input
                  type={f.kind === "datetime" ? "datetime-local" : "number"}
                  step={f.kind === "money" ? "0.01" : undefined}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <DateTimeField label="Registrado em" value={at} onChange={setAt} />
          <div className="grid gap-1.5">
            <Label>{milestone.requireNotes ? "O que foi pedido? *" : "Observações"}</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          onConfirm={() =>
            run(() => {
              // datetime-local precisa virar ISO antes de ir para o registro.
              const vals: MilestoneValues = { ...values };
              for (const f of milestone.fields ?? []) {
                if (f.kind === "datetime" && vals[f.name]) {
                  const d = fromLocalInput(vals[f.name]!);
                  vals[f.name] = d ? d.toISOString() : "";
                }
              }
              return registerMilestone(
                lead,
                milestone,
                { at: fromLocalInput(at) ?? new Date(), observacoes: obs, values: vals, pendingId },
                ctxFor(userId),
              );
            }, `${milestone.label}: registrado`)
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const DECISION_COPY: Record<Decision, { title: string; desc: string }> = {
  proposta_aceita: {
    title: "Lead aprovou a proposta",
    desc: "O lead segue para a etapa de contrato. Ele só será marcado como ganho quando o contrato for assinado.",
  },
  proposta_negociar: {
    title: "Lead quer negociar",
    desc: "O lead segue para a negociação de condições de pagamento.",
  },
  negociacao_aprovada: {
    title: "Proposta aprovada após negociação",
    desc: "O lead segue para a etapa de contrato.",
  },
};

export function DecisionDialog({
  lead,
  open,
  onOpenChange,
  userId,
  decision,
  pendingPresentationId = null,
}: BaseProps & { decision: Decision | null; pendingPresentationId?: string | null }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [at, setAt] = useState("");
  const [obs, setObs] = useState("");
  useEffect(() => {
    if (open) {
      setAt(toLocalInput(new Date()));
      setObs("");
    }
  }, [open]);
  if (!decision) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{DECISION_COPY[decision].title}</DialogTitle>
          <DialogDescription>{DECISION_COPY[decision].desc}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <DateTimeField label="Data e hora" value={at} onChange={setAt} />
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          onConfirm={() =>
            run(
              () =>
                registerDecision(
                  lead,
                  decision,
                  { at: fromLocalInput(at) ?? new Date(), observacoes: obs },
                  ctxFor(userId),
                  pendingPresentationId,
                ),
              "Decisão registrada",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const CLOSE_HINT: Record<FinalStage, string> = {
  ganho: "Contrato assinado. O lead pode ser vinculado a um cliente existente.",
  perdido: "O lead não seguiu adiante (sem interesse, recusa da proposta etc.).",
  sem_resposta: "O lead não respondeu à cadência.",
  contrato_nao_concluido: "A proposta foi aceita, mas o contrato não foi assinado.",
};

export function CloseLeadDialog({
  lead,
  open,
  onOpenChange,
  userId,
  initial,
  initialReason,
}: BaseProps & { initial?: FinalStage; initialReason?: string }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [resultado, setResultado] = useState<FinalStage>("perdido");
  const [motivo, setMotivo] = useState("");
  const [at, setAt] = useState("");
  const [assinado, setAssinado] = useState(false);
  const [assinadoEm, setAssinadoEm] = useState("");
  const [clientId, setClientId] = useState("");

  const { data: activities = [] } = useLeadActivities(lead.id);
  const contractRecorded = useMemo(
    () => activities.some((a) => a.chave === "contrato_assinado" && a.status === "realizada"),
    [activities],
  );

  const { data: clients = [] } = useQuery({
    queryKey: ["leads", "clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
    enabled: open && resultado === "ganho",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) {
      setResultado(initial ?? "perdido");
      setMotivo(initialReason ?? "");
      setAt(toLocalInput(new Date()));
      setAssinado(false);
      setAssinadoEm(toLocalInput(new Date()));
      setClientId(lead.client_id ?? "");
    }
  }, [open, initial, initialReason, lead]);

  const ganhoOk = resultado !== "ganho" || contractRecorded || (assinado && !!assinadoEm);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar lead</DialogTitle>
          <DialogDescription>
            O histórico é preservado e os lembretes pendentes são cancelados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Resultado final</Label>
            <Select value={resultado} onValueChange={(v) => setResultado(v as FinalStage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINAL_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{CLOSE_HINT[resultado]}</p>
          </div>

          {resultado === "ganho" && (
            <div className="grid gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              {contractRecorded ? (
                <p className="text-xs text-emerald-300">
                  Assinatura do contrato já registrada no histórico.
                </p>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={assinado}
                      onCheckedChange={(v) => setAssinado(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      O contrato foi assinado
                      {!ganhoOk && (
                        <span className="block text-[11px] text-amber-400">
                          Para encerrar como ganho, marque a assinatura e informe a data.
                        </span>
                      )}
                    </span>
                  </label>
                  {assinado && (
                    <DateTimeField
                      label="Assinado em"
                      value={assinadoEm}
                      onChange={setAssinadoEm}
                    />
                  )}
                </>
              )}
              <div className="grid gap-1.5">
                <Label>Vincular a cliente existente</Label>
                <Select
                  value={clientId || "none"}
                  onValueChange={(v) => setClientId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nenhum por enquanto —</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Nenhum cliente é criado automaticamente. Se ele ainda não existir, cadastre em{" "}
                  <Link to="/clientes" className="text-primary underline-offset-2 hover:underline">
                    Clientes
                  </Link>{" "}
                  e vincule depois em “Editar dados”.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>{resultado === "ganho" ? "Observações" : "Motivo"}</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <DateTimeField label="Encerrado em" value={at} onChange={setAt} />
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          disabled={!ganhoOk}
          label="Encerrar"
          onConfirm={() =>
            run(
              () =>
                closeLead(
                  lead,
                  {
                    resultado,
                    motivo,
                    at: fromLocalInput(at) ?? new Date(),
                    clientId: resultado === "ganho" ? clientId || null : undefined,
                    contratoAssinadoEm:
                      resultado === "ganho" && !contractRecorded
                        ? fromLocalInput(assinadoEm)
                        : null,
                  },
                  ctxFor(userId),
                ),
              `Lead encerrado: ${STAGE_META[resultado].label}`,
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function ReopenDialog({
  lead,
  open,
  onOpenChange,
  userId,
  initial,
}: BaseProps & { initial?: LeadStage }) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange, open);
  const [etapa, setEtapa] = useState<LeadStage>("primeiro_contato");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    if (open) {
      setEtapa(initial ?? "primeiro_contato");
      setMotivo("");
    }
  }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir lead</DialogTitle>
          <DialogDescription>
            O resultado anterior continua registrado na linha do tempo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Voltar para a etapa</Label>
            <Select value={etapa} onValueChange={(v) => setEtapa(v as LeadStage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_STAGES.filter((s) => s !== "cadencia" && s !== "reuniao").map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Motivo</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          label="Reabrir"
          onConfirm={() =>
            run(() => reopenLead(lead, etapa, motivo, ctxFor(userId)), "Lead reaberto")
          }
        />
      </DialogContent>
    </Dialog>
  );
}
