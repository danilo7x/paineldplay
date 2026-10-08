import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlarmClock,
  CheckCircle2,
  Circle,
  Clipboard,
  ExternalLink,
  Loader2,
  Send,
  MessageCircle,
  Play,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useApplyLeadChange } from "../api";
import {
  CADENCE_LABEL,
  CLOSE_CADENCE_KEY,
  cadenceProgress,
  personalizeTemplate,
  type CadenceKey,
  type TemplateVars,
  waitsFrom,
} from "../cadence";
import {
  CADENCE_STATUS_LABEL,
  channelLabel,
  isFinalStage,
  type Lead,
  type LeadActivity,
  type MessageTemplate,
} from "../model";
import {
  closeCadenceWithoutResponse,
  registerTemplateSent,
  reschedulePlanned,
  startCadence,
  type LeadChange,
  type WorkflowCtx,
} from "../workflow";
import { ChannelSelect, DateTimeField, DialogActions } from "./dialog-kit";
import { useLeadRun } from "./useLeadRun";
import { SectionCard } from "./shared";
import { sendWhatsapp, useWhatsappStatus } from "../whatsapp";
import { formatDateTime, fromLocalInput, toLocalInput } from "../format";

export function CadencePanel({
  lead,
  activities,
  templates,
  userId,
  vars,
  onRespond,
}: {
  lead: Lead;
  activities: LeadActivity[];
  templates: MessageTemplate[];
  userId: string;
  vars: TemplateVars;
  onRespond: () => void;
}) {
  const apply = useApplyLeadChange(lead.id);
  const [sendKey, setSendKey] = useState<CadenceKey | null>(null);
  const [adjust, setAdjust] = useState<{ id: string; at: string | null } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const ciclo = lead.cadencia_ciclo ?? 0;
  const steps = useMemo(() => cadenceProgress(activities, ciclo), [activities, ciclo]);
  const active = lead.cadencia_status === "ativa";
  const closed = isFinalStage(lead.etapa);
  const ctx = (): WorkflowCtx => ({ userId, now: new Date(), waits: waitsFrom(templates) });
  const nowIso = new Date().toISOString();

  const tplByKey = (k: string) => templates.find((t) => t.chave === k);
  const sendStep = sendKey ? steps.find((s) => s.key === sendKey) : null;

  return (
    <SectionCard
      title="Cadência de WhatsApp"
      icon={MessageCircle}
      action={
        lead.cadencia_status ? (
          <Badge variant="outline" className="text-[10px]">
            {CADENCE_STATUS_LABEL[lead.cadencia_status] ?? lead.cadencia_status}
            {ciclo > 1 ? ` · ciclo ${ciclo}` : ""}
          </Badge>
        ) : null
      }
    >
      {ciclo === 0 ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Use quando o lead não atender ou não responder: 4 templates e o break-up, com lembretes
            em dias úteis. Nenhuma mensagem é enviada automaticamente.
          </p>
          {!closed && (
            <Button
              size="sm"
              variant="secondary"
              disabled={lead.nao_contatar || apply.isPending}
              onClick={() =>
                apply.mutate({ change: startCadence(lead, ctx()), success: "Cadência iniciada" })
              }
            >
              <Play className="size-4" /> Iniciar cadência
            </Button>
          )}
          {lead.nao_contatar && (
            <p className="text-xs text-amber-400">O lead pediu para não receber novos contatos.</p>
          )}
        </div>
      ) : (
        <ol className="space-y-1.5">
          {steps.map((s) => {
            const isClose = s.key === CLOSE_CADENCE_KEY;
            const label = isClose
              ? "Encerrar como “Sem resposta”"
              : CADENCE_LABEL[s.key as CadenceKey];
            const overdue = s.state === "prevista" && s.dueAt && s.dueAt < nowIso;
            return (
              <li
                key={s.key}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/50 bg-background/40 px-3 py-2",
                  s.state === "prevista" && "border-primary/40 bg-primary/5",
                )}
              >
                <StepIcon state={s.state} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className={cn("text-[11px] text-muted-foreground", overdue && "text-red-400")}>
                    {s.state === "enviada" &&
                      `${isClose ? "Encerrada" : "Enviada"} em ${formatDateTime(s.sentAt)}${s.canal ? ` · ${channelLabel(s.canal)}` : ""}`}
                    {s.state === "prevista" &&
                      `Previsto para ${formatDateTime(s.dueAt)}${overdue ? " · atrasado" : ""}`}
                    {s.state === "cancelada" && "Não enviada (cadência interrompida)"}
                    {s.state === "pendente" && "Aguardando etapa anterior"}
                  </p>
                </div>
                {s.state === "prevista" && active && !closed && (
                  <div className="flex w-full gap-1.5 sm:w-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setAdjust({ id: s.activityId!, at: s.dueAt ?? null })}
                    >
                      <AlarmClock className="size-3.5" /> Ajustar data
                    </Button>
                    {isClose ? (
                      <Button size="sm" className="h-8" onClick={() => setConfirmClose(true)}>
                        Encerrar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => setSendKey(s.key as CadenceKey)}
                      >
                        Preparar mensagem
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {ciclo > 0 && !closed && (
        <div className="mt-3 flex flex-wrap gap-2">
          {active && (
            <Button size="sm" variant="secondary" onClick={onRespond}>
              Lead respondeu
            </Button>
          )}
          {!active && !lead.nao_contatar && (
            <Button
              size="sm"
              variant="ghost"
              disabled={apply.isPending}
              onClick={() =>
                apply.mutate({
                  change: startCadence(lead, ctx()),
                  success: "Nova cadência iniciada",
                })
              }
            >
              <Play className="size-4" /> Iniciar novo ciclo
            </Button>
          )}
        </div>
      )}

      {sendKey && (
        <SendTemplateDialog
          lead={lead}
          open={!!sendKey}
          onOpenChange={(v) => !v && setSendKey(null)}
          template={tplByKey(sendKey)}
          title={`Enviar ${CADENCE_LABEL[sendKey]}`}
          vars={vars}
          build={(input) =>
            registerTemplateSent(lead, sendKey, sendStep?.activityId ?? null, input, ctx())
          }
          success={`${CADENCE_LABEL[sendKey]} registrado como enviado`}
          pendingActivityId={sendStep?.state === "prevista" ? (sendStep.activityId ?? null) : null}
        />
      )}

      <AdjustDateDialog lead={lead} target={adjust} onClose={() => setAdjust(null)} />

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar como “Sem resposta”?</DialogTitle>
            <DialogDescription>
              O break-up foi enviado e o lead não respondeu. O histórico fica preservado para uma
              eventual retomada.
            </DialogDescription>
          </DialogHeader>
          <DialogActions
            onCancel={() => setConfirmClose(false)}
            pending={apply.isPending}
            label="Encerrar"
            onConfirm={() => {
              const pending = steps.find(
                (s) => s.key === CLOSE_CADENCE_KEY && s.state === "prevista",
              );
              apply.mutate(
                {
                  change: closeCadenceWithoutResponse(lead, pending?.activityId ?? null, ctx()),
                  success: "Lead encerrado como sem resposta",
                },
                { onSuccess: () => setConfirmClose(false) },
              );
            }}
          />
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function StepIcon({ state }: { state: string }) {
  if (state === "enviada") return <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />;
  if (state === "prevista") return <AlarmClock className="size-4 shrink-0 text-primary" />;
  if (state === "cancelada") return <XCircle className="size-4 shrink-0 text-muted-foreground" />;
  return <Circle className="size-4 shrink-0 text-muted-foreground/50" />;
}

/* ------------------------------------------------------------------ */

function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function SendTemplateDialog({
  lead,
  open,
  onOpenChange,
  template,
  title,
  vars,
  build,
  success,
  pendingActivityId,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: MessageTemplate | undefined;
  title: string;
  vars: TemplateVars;
  build: (input: { sentAt: Date; canal: string; observacoes?: string }) => LeadChange;
  success: string;
  /** Mensagem prevista que este envio cumpre; necessária para enviar pela API. */
  pendingActivityId: string | null;
}) {
  const { run, error, pending } = useLeadRun(lead, onOpenChange);
  const { data: waStatus, isLoading: waLoading } = useWhatsappStatus();
  const [apiState, setApiState] = useState<"idle" | "sending" | "sent">("idle");
  const [text, setText] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [obs, setObs] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(template ? personalizeTemplate(template.conteudo, vars).text : "");
    setSentAt(toLocalInput(new Date()));
    setCanal("whatsapp");
    setObs("");
    setCopied(false);
    setApiState("idle");
  }, [open, template, vars]);

  const missing = useMemo(() => {
    const found: string[] = [...(text.match(/\[[^\]]+\]/g) ?? [])];
    if (/\bLEAD\b/.test(text)) found.push("LEAD");
    return Array.from(new Set(found));
  }, [text]);
  const wa = whatsappLink(lead.telefone, text);

  const apiBlocked = !pendingActivityId
    ? "Não há mensagem prevista para este lead."
    : waLoading
      ? "Verificando a conexão do WhatsApp…"
      : !waStatus?.configured
        ? "Envio pelo WhatsApp ainda não configurado (Evolution API)."
        : !waStatus.connected
          ? "O WhatsApp da DPlay está desconectado na Evolution API."
          : !wa
            ? "O lead não tem telefone de WhatsApp válido."
            : missing.length
              ? "Complete os campos entre colchetes antes de enviar."
              : null;

  async function sendViaApi() {
    if (apiBlocked || !pendingActivityId) return;
    setApiState("sending");
    try {
      const { messageId } = await sendWhatsapp({
        leadId: lead.id,
        activityId: pendingActivityId,
        text,
      });
      setApiState("sent");
      const note = messageId
        ? `Enviada pela Evolution API (id ${messageId})`
        : "Enviada pela Evolution API";
      run(
        () =>
          build({
            sentAt: new Date(),
            canal: "whatsapp_api",
            observacoes: [obs.trim(), note].filter(Boolean).join("\n"),
          }),
        success,
      );
    } catch (e) {
      setApiState("idle");
      toast.error("Mensagem não enviada", { description: (e as Error).message });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Revise a mensagem e envie pelo WhatsApp da DPlay com um clique. Se preferir enviar à
            mão, copie o texto e registre o envio abaixo — só então ela conta como enviada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {template?.orientacao && (
            <p className="rounded-lg border border-border/60 bg-background/40 p-2.5 text-[11px] text-muted-foreground">
              {template.orientacao}
            </p>
          )}
          {!template && (
            <p className="text-xs text-amber-400">
              Modelo não encontrado. Peça a um administrador para cadastrá-lo.
            </p>
          )}
          <div className="grid gap-1.5">
            <Label>Mensagem personalizada</Label>
            <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />
            {missing.length > 0 && (
              <p className="text-[11px] text-amber-400">
                Complete antes de enviar: {missing.join(", ")}
              </p>
            )}
          </div>
          <div className="grid gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <Button
              type="button"
              onClick={sendViaApi}
              disabled={!!apiBlocked || apiState !== "idle" || pending}
              className="gap-2 sm:w-fit"
            >
              {apiState === "sending" || (apiState === "sent" && pending) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {apiState === "sent" ? "Mensagem enviada" : "Enviar pelo WhatsApp"}
            </Button>
            {apiBlocked && apiState === "idle" && (
              <p className="text-[11px] text-muted-foreground">{apiBlocked}</p>
            )}
            {apiState === "sent" && !pending && (
              <p className="text-[11px] text-amber-400">
                A mensagem já foi enviada pelo WhatsApp, mas o registro não foi salvo. Clique em
                “Registrar envio” abaixo — não envie de novo.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={copy} disabled={!text}>
              <Clipboard className="size-4" /> {copied ? "Copiada" : "Copiar mensagem"}
            </Button>
            {wa && (
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={wa} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Abrir conversa no WhatsApp
                </a>
              </Button>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
            <p className="text-xs font-medium">Registrar envio</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateTimeField label="Enviada em" value={sentAt} onChange={setSentAt} />
              <ChannelSelect value={canal} onChange={setCanal} />
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          pending={pending}
          error={error}
          label="Registrar envio"
          onConfirm={() =>
            run(
              () =>
                build({ sentAt: fromLocalInput(sentAt) ?? new Date(), canal, observacoes: obs }),
              success,
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function AdjustDateDialog({
  lead,
  target,
  onClose,
}: {
  lead: Lead;
  target: { id: string; at: string | null } | null;
  onClose: () => void;
}) {
  const { run, error, pending } = useLeadRun(lead, (v) => !v && onClose());
  const [at, setAt] = useState("");
  useEffect(() => {
    if (target) setAt(toLocalInput(target.at ?? new Date()));
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar data prevista</DialogTitle>
          <DialogDescription>A próxima ação do lead acompanha a nova data.</DialogDescription>
        </DialogHeader>
        <DateTimeField label="Nova data" value={at} onChange={setAt} />
        <DialogActions
          onCancel={onClose}
          pending={pending}
          error={error}
          label="Salvar"
          disabled={!at}
          onConfirm={() =>
            run(
              () => {
                const d = fromLocalInput(at);
                if (!d || !target) throw new Error("Informe a data");
                return reschedulePlanned(target.id, d, true);
              },
              `Previsto para ${format(fromLocalInput(at) ?? new Date(), "dd/MM HH:mm")}`,
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}
