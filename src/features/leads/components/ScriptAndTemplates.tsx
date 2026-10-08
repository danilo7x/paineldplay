import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { leadKeys, useTemplates } from "../api";
import type { MessageTemplate } from "../model";
import { CALL_SCRIPT } from "../script";

/** Destaca os campos variáveis ([nome], [empresa]…) no texto. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") ? (
          <span key={i} className="rounded bg-primary/15 px-1 font-medium text-primary">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function CallScriptSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Roteiro de ligação</SheetTitle>
          <SheetDescription>
            Material de apoio. Adapte as frases à conversa — o objetivo é entender a necessidade e,
            se fizer sentido, marcar a reunião de diagnóstico.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 pb-6">
          {CALL_SCRIPT.map((s, i) => (
            <section key={s.title} className="rounded-xl border border-border/50 bg-card/50 p-3">
              <h3 className="text-sm font-semibold">
                <span className="mr-2 text-primary">{i + 1}.</span>
                {s.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{s.guidance}</p>
              <div className="mt-2 space-y-1.5 border-l-2 border-primary/60 pl-3 text-sm">
                {s.lines.map((l) => (
                  <p key={l}>
                    <Highlight text={l} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TemplatesDialog({
  open,
  onOpenChange,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit: boolean;
}) {
  const { data: templates = [], isLoading } = useTemplates();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelos de mensagem</DialogTitle>
          <DialogDescription>
            Textos da cadência de WhatsApp. Os campos entre colchetes são preenchidos com os dados
            do lead quando disponíveis.{canEdit ? "" : " Somente administradores podem editar."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((t) => (
              <TemplateEditor key={t.chave} template={t} canEdit={canEdit} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditor({ template, canEdit }: { template: MessageTemplate; canEdit: boolean }) {
  const qc = useQueryClient();
  const [conteudo, setConteudo] = useState(template.conteudo);
  const [espera, setEspera] = useState(String(template.espera_dias_uteis));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setConteudo(template.conteudo);
    setEspera(String(template.espera_dias_uteis));
  }, [template]);
  const dirty = conteudo !== template.conteudo || espera !== String(template.espera_dias_uteis);

  async function save() {
    const n = Number(espera);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Dias úteis inválidos");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("lead_message_templates")
      .update({ conteudo, espera_dias_uteis: n, updated_by: auth.user?.id ?? null })
      .eq("chave", template.chave);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success(`${template.titulo} atualizado`);
    qc.invalidateQueries({ queryKey: leadKeys.templates });
  }

  return (
    <section className="rounded-xl border border-border/50 bg-card/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{template.titulo}</h3>
        {template.na_cadencia && (
          <span className="text-[11px] text-muted-foreground">
            Sem resposta por {template.espera_dias_uteis} dia(s) útil(eis) →{" "}
            {template.chave === "break_up" ? "encerrar" : "próximo passo"}
          </span>
        )}
      </div>
      {template.orientacao && (
        <p className="mt-1 text-[11px] text-muted-foreground">{template.orientacao}</p>
      )}
      {canEdit ? (
        <div className="mt-2 grid gap-2">
          <Textarea rows={7} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          <div className="flex flex-wrap items-end justify-between gap-2">
            {template.na_cadencia ? (
              <div className="grid gap-1">
                <Label className="text-xs">Dias úteis de espera</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-24"
                  value={espera}
                  onChange={(e) => setEspera(e.target.value)}
                />
              </div>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm">
          <Highlight text={template.conteudo} />
        </p>
      )}
    </section>
  );
}
