import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { applyLeadChange, leadKeys, useCommercialPeople } from "../api";
import { CANAL_ORIGEM, type Lead } from "../model";

type Form = {
  nome: string;
  empresa: string;
  contato: string;
  telefone: string;
  canal_origem: string;
  origem: string;
  necessidade_inicial: string;
  responsavel_id: string;
  valor_estimado: string;
  client_id: string;
  observacoes: string;
};

const blank = (userId: string): Form => ({
  nome: "",
  empresa: "",
  contato: "",
  telefone: "",
  canal_origem: "",
  origem: "",
  necessidade_inicial: "",
  responsavel_id: userId,
  valor_estimado: "",
  client_id: "",
  observacoes: "",
});

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  userId,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead | null;
  userId: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(blank(userId));
  const [saving, setSaving] = useState(false);
  const { data: people = [] } = useCommercialPeople();

  const { data: clients = [] } = useQuery({
    queryKey: ["leads", "clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
    enabled: open && lead?.etapa === "ganho",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        nome: lead.nome,
        empresa: lead.empresa ?? "",
        contato: lead.contato ?? "",
        telefone: lead.telefone ?? "",
        canal_origem: lead.canal_origem ?? "",
        origem: lead.origem ?? "",
        necessidade_inicial: lead.necessidade_inicial ?? "",
        responsavel_id: lead.responsavel_id ?? "",
        valor_estimado: lead.valor_estimado != null ? String(lead.valor_estimado) : "",
        client_id: lead.client_id ?? "",
        observacoes: lead.observacoes ?? "",
      });
    } else {
      setForm(blank(userId));
    }
  }, [lead, open, userId]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const responsavel = isAdmin ? form.responsavel_id || null : userId;
      const payload = {
        nome: form.nome.trim(),
        empresa: form.empresa.trim() || null,
        contato: form.contato.trim() || null,
        telefone: form.telefone.trim() || null,
        canal_origem: form.canal_origem || null,
        origem: form.origem.trim() || null,
        necessidade_inicial: form.necessidade_inicial.trim() || null,
        responsavel_id: responsavel,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        observacoes: form.observacoes.trim() || null,
        ...(lead?.etapa === "ganho" ? { client_id: form.client_id || null } : {}),
      };
      if (lead) {
        await applyLeadChange(lead.id, {
          patch: payload,
          activities: [],
          updates: [],
          cancelPending: false,
        });
        toast.success("Lead atualizado");
        qc.invalidateQueries({ queryKey: leadKeys.all });
        onOpenChange(false);
      } else {
        const { data, error } = await supabase
          .from("partner_leads")
          .insert({ ...payload, etapa: "novo", created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Lead cadastrado");
        qc.invalidateQueries({ queryKey: leadKeys.all });
        onOpenChange(false);
        navigate({ to: "/leads/$id", params: { id: data.id } });
      }
    } catch (e) {
      toast.error("Não foi possível salvar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar dados do lead" : "Cadastrar lead"}</DialogTitle>
          <DialogDescription>
            {lead
              ? "A etapa muda pelas ações do processo comercial."
              : "O lead entra no funil como “Novo lead”."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Nome do contato *</Label>
              <Input value={form.nome} onChange={(e) => set("nome")(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Empresa</Label>
              <Input value={form.empresa} onChange={(e) => set("empresa")(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input
                inputMode="tel"
                value={form.telefone}
                onChange={(e) => set("telefone")(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Contato (e-mail, cargo…)</Label>
              <Input value={form.contato} onChange={(e) => set("contato")(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Canal de origem</Label>
              <Select
                value={form.canal_origem || "none"}
                onValueChange={(v) => set("canal_origem")(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— não informado —</SelectItem>
                  {CANAL_ORIGEM.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Detalhe da origem</Label>
              <Input
                value={form.origem}
                onChange={(e) => set("origem")(e.target.value)}
                placeholder="quem indicou, post, evento…"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Necessidade inicial percebida</Label>
            <Textarea
              rows={2}
              value={form.necessidade_inicial}
              onChange={(e) => set("necessidade_inicial")(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Responsável comercial</Label>
              {isAdmin ? (
                <Select
                  value={form.responsavel_id || "none"}
                  onValueChange={(v) => set("responsavel_id")(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem responsável —</SelectItem>
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
            <div className="grid gap-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_estimado}
                onChange={(e) => set("valor_estimado")(e.target.value)}
              />
            </div>
          </div>
          {lead?.etapa === "ganho" && (
            <div className="grid gap-1.5">
              <Label>Cliente vinculado</Label>
              <Select
                value={form.client_id || "none"}
                onValueChange={(v) => set("client_id")(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nenhum —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => set("observacoes")(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!form.nome.trim() || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
