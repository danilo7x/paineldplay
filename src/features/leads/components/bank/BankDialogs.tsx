import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Person } from "../../api";
import {
  GROUP_COLORS,
  IMPORT_FIELD_LABEL,
  MEETING_STATUS,
  matchBankStatus,
  normalizePhone,
  normalizeText,
  parseLeadList,
  type BankGroup,
  type BankLead,
  type BankStatus,
  type ImportField,
} from "../../bank";
import { useCreateBankLeads, useSaveBankGroup, useUpdateBankLeads } from "../../bank-api";
import { fromLocalInput, toLocalInput } from "../../format";
import { DateTimeField } from "../dialog-kit";
import { StatusGrid, StatusPill } from "./BankCells";

const NO_GROUP = "__none__";

/* ------------------------------------------------------------------ */
/* Reunião marcada                                                    */
/* ------------------------------------------------------------------ */

export function MeetingDialog({
  open,
  onOpenChange,
  leadName,
  current,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadName: string;
  current: string | null;
  pending?: boolean;
  onConfirm: (at: Date) => void;
}) {
  const [at, setAt] = useState("");
  useEffect(() => {
    if (open) setAt(toLocalInput(current));
  }, [open, current]);
  const date = fromLocalInput(at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="size-5 text-primary" />
            {current ? "Alterar data da reunião" : "Reunião marcada"}
          </DialogTitle>
          <DialogDescription>
            {leadName} vai para o Kanban na etapa “Reunião de diagnóstico”, com a reunião prevista
            no histórico. {current ? "Mudar a data reagenda a reunião lá também." : ""}
          </DialogDescription>
        </DialogHeader>
        <DateTimeField label="Data e hora da reunião *" value={at} onChange={setAt} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!date || pending} onClick={() => date && onConfirm(date)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {current ? "Salvar data" : "Marcar e enviar ao Kanban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Cadastro / edição de um lead                                       */
/* ------------------------------------------------------------------ */

type LeadForm = {
  nome: string;
  empresa: string;
  telefone: string;
  grupo_id: string;
  contato_por: string;
  status: BankStatus | null;
  reuniao_em: string;
  observacoes: string;
};

export function BankLeadDialog({
  open,
  onOpenChange,
  lead,
  groups,
  defaultGroupId,
  people,
  userId,
  isAdmin,
  onMeetingSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: BankLead | null;
  groups: BankGroup[];
  defaultGroupId?: string | null;
  people: Person[];
  userId: string;
  isAdmin: boolean;
  onMeetingSaved?: (lead: BankLead) => void;
}) {
  const create = useCreateBankLeads();
  const update = useUpdateBankLeads();
  const [form, setForm] = useState<LeadForm>(() => blankForm(defaultGroupId));
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      lead
        ? {
            nome: lead.nome,
            empresa: lead.empresa ?? "",
            telefone: lead.telefone ?? "",
            grupo_id: lead.grupo_id ?? NO_GROUP,
            contato_por: lead.contato_por ?? "",
            status: (lead.status as BankStatus | null) ?? null,
            reuniao_em: toLocalInput(lead.reuniao_em),
            observacoes: lead.observacoes ?? "",
          }
        : blankForm(defaultGroupId),
    );
  }, [open, lead, defaultGroupId]);

  const set = <K extends keyof LeadForm>(k: K, v: LeadForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const lockedByOther = !isAdmin && !!lead?.contato_por && lead.contato_por !== userId;
  const personOptions = isAdmin ? people : people.filter((p) => p.id === userId);
  const meeting = form.status === MEETING_STATUS;
  const meetingAt = fromLocalInput(form.reuniao_em);
  const pending = create.isPending || update.isPending;
  const canSave = form.nome.trim() && (!meeting || meetingAt);

  async function save() {
    if (!canSave) return;
    // Quem muda o status de um lead sem dono passa a ser quem entrou em contato.
    const contato =
      form.contato_por ||
      (form.status && form.status !== "novo_lead" && !lockedByOther ? userId : "");
    const patch = {
      nome: form.nome.trim(),
      empresa: form.empresa.trim() || null,
      telefone: form.telefone.trim() || null,
      grupo_id: form.grupo_id === NO_GROUP ? null : form.grupo_id || null,
      status: form.status,
      reuniao_em: meeting && meetingAt ? meetingAt.toISOString() : (lead?.reuniao_em ?? null),
      observacoes: form.observacoes.trim() || null,
      ...(lockedByOther ? {} : { contato_por: contato || null }),
    };
    try {
      let saved: BankLead | undefined;
      if (lead) {
        [saved] = await update.mutateAsync({ ids: [lead.id], patch, success: "Lead atualizado" });
      } else {
        [saved] = await create.mutateAsync({ rows: [{ ...patch, created_by: userId }] });
        toast.success("Lead cadastrado no banco");
      }
      if (saved?.lead_id && meeting) onMeetingSaved?.(saved);
      onOpenChange(false);
    } catch {
      // O erro já aparece no aviso da mutação.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead do banco" : "Adicionar lead"}</DialogTitle>
          <DialogDescription>
            Ao marcar “Reunião Marcada” com a data, o lead entra no Kanban automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bank-nome">Nome da pessoa *</Label>
              <Input
                id="bank-nome"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bank-empresa">Nome da empresa</Label>
              <Input
                id="bank-empresa"
                value={form.empresa}
                onChange={(e) => set("empresa", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bank-tel">Telefone / WhatsApp</Label>
              <Input
                id="bank-tel"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Lista</Label>
              <Select value={form.grupo_id || NO_GROUP} onValueChange={(v) => set("grupo_id", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>Sem lista</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Quem entrou em contato</Label>
              {lockedByOther ? (
                <Input
                  disabled
                  value={people.find((p) => p.id === lead?.contato_por)?.nome ?? "Outra pessoa"}
                />
              ) : (
                <Select
                  value={form.contato_por || "none"}
                  onValueChange={(v) => set("contato_por", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— ninguém ainda —</SelectItem>
                    {personOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome ?? p.email}
                        {p.id === userId ? " (você)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Status do lead</Label>
              <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-9 overflow-hidden rounded-md border border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <StatusPill status={form.status} className="h-full" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <StatusGrid
                    value={form.status}
                    onSelect={(s) => {
                      set("status", s);
                      setStatusOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {meeting && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <DateTimeField
                label="Data e hora da reunião *"
                value={form.reuniao_em}
                onChange={(v) => set("reuniao_em", v)}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                O lead vai para o Kanban em “Reunião de diagnóstico”, no nome de quem entrou em
                contato.
              </p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="bank-obs">Observações</Label>
            <Textarea
              id="bank-obs"
              rows={2}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave || pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blankForm(groupId?: string | null): LeadForm {
  return {
    nome: "",
    empresa: "",
    telefone: "",
    grupo_id: groupId ?? NO_GROUP,
    contato_por: "",
    status: "novo_lead",
    reuniao_em: "",
    observacoes: "",
  };
}

/* ------------------------------------------------------------------ */
/* Lista (grupo)                                                      */
/* ------------------------------------------------------------------ */

export function GroupDialog({
  open,
  onOpenChange,
  group,
  nextOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: BankGroup | null;
  nextOrder: number;
}) {
  const save = useSaveBankGroup();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(GROUP_COLORS[0]);
  useEffect(() => {
    if (!open) return;
    setNome(group?.nome ?? "");
    setCor(group?.cor ?? GROUP_COLORS[nextOrder % GROUP_COLORS.length]);
  }, [open, group, nextOrder]);

  async function submit() {
    if (!nome.trim()) return;
    await save.mutateAsync(
      group
        ? { id: group.id, nome: nome.trim(), cor }
        : { nome: nome.trim(), cor, ordem: nextOrder },
    );
    toast.success(group ? "Lista atualizada" : "Lista criada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{group ? "Editar lista" : "Nova lista"}</DialogTitle>
          <DialogDescription>
            Agrupe os leads por origem ou campanha (ex.: “Indicações PTPJ 26.2”).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="group-nome">Nome da lista *</Label>
            <Input
              id="group-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={cn(
                    "size-7 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    cor === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!nome.trim() || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Importação de lista                                                */
/* ------------------------------------------------------------------ */

async function readFileText(file: File) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  // CSV salvo pelo Excel em pt-BR costuma vir em Windows-1252.
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

export function ImportDialog({
  open,
  onOpenChange,
  groups,
  leads,
  people,
  userId,
  isAdmin,
  nextOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: BankGroup[];
  leads: BankLead[];
  people: Person[];
  userId: string;
  isAdmin: boolean;
  nextOrder: number;
}) {
  const create = useCreateBankLeads();
  const saveGroup = useSaveBankGroup();
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>("new");
  const [newName, setNewName] = useState("");
  const [skipDupes, setSkipDupes] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);

  // Só ao abrir: a lista nova criada durante a importação não pode limpar o formulário.
  useEffect(() => {
    if (!open) return;
    setText("");
    setNewName("");
    setTarget("new");
    setSkipDupes(true);
    setProgress(null);
  }, [open]);

  const parsed = useMemo(() => parseLeadList(text), [text]);
  const knownPhones = useMemo(
    () => new Set(leads.map((l) => normalizePhone(l.telefone)).filter((p) => p.length >= 8)),
    [leads],
  );

  const personByName = useMemo(() => {
    const map = new Map<string, string>();
    people.forEach((p) => {
      const keys = [p.nome, p.email, p.nome?.split(" ")[0]].map(normalizeText).filter(Boolean);
      keys.forEach((k) => !map.has(k) && map.set(k, p.id));
    });
    return map;
  }, [people]);

  const prepared = useMemo(() => {
    const seen = new Set<string>();
    let dupes = 0;
    const rows = parsed.rows.flatMap((r) => {
      const phone = normalizePhone(r.telefone);
      if (skipDupes && phone.length >= 8) {
        if (knownPhones.has(phone) || seen.has(phone)) {
          dupes++;
          return [];
        }
        seen.add(phone);
      }
      const person = r.contato_por ? personByName.get(normalizeText(r.contato_por)) : undefined;
      return [
        {
          nome: r.nome!.slice(0, 200),
          empresa: r.empresa ?? null,
          telefone: r.telefone ?? null,
          status: r.status ? (matchBankStatus(r.status) ?? "novo_lead") : "novo_lead",
          // Colaborador só importa contatos no próprio nome.
          contato_por: person && (isAdmin || person === userId) ? person : null,
          observacoes: r.observacoes ?? null,
        },
      ];
    });
    return { rows, dupes };
  }, [parsed, skipDupes, knownPhones, personByName, isAdmin, userId]);

  const fields = Object.keys(parsed.columns) as ImportField[];
  const busy = progress !== null;
  const canImport =
    prepared.rows.length > 0 && (target !== "new" || newName.trim().length > 0) && !busy;

  async function run() {
    if (!canImport) return;
    setProgress(0);
    try {
      let grupoId: string | null = target === "none" ? null : target;
      if (target === "new") {
        const g = await saveGroup.mutateAsync({
          nome: newName.trim(),
          ordem: nextOrder,
          cor: GROUP_COLORS[nextOrder % GROUP_COLORS.length],
        });
        grupoId = g.id;
      }
      const saved = await create.mutateAsync({
        rows: prepared.rows.map((r) => ({ ...r, grupo_id: grupoId, created_by: userId })),
        onProgress: setProgress,
      });
      toast.success(`${saved.length} leads importados`, {
        description: prepared.dupes
          ? `${prepared.dupes} telefones repetidos ignorados.`
          : undefined,
      });
      onOpenChange(false);
    } catch {
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar lista de leads</DialogTitle>
          <DialogDescription>
            Cole as linhas de uma planilha (Excel, Google Sheets, export do monday) ou envie um CSV.
            Colunas reconhecidas pelo cabeçalho: Nome, Empresa, Telefone, Status, Quem entrou em
            contato e Observações. Sem cabeçalho, a ordem é Nome · Empresa · Telefone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="import-text">Dados</Label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary hover:underline">
                <FileUp className="size-3.5" /> Escolher arquivo CSV
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setText(await readFileText(f));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <Textarea
              id="import-text"
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Nome\tEmpresa\tTelefone\nKayo Carvalho\tPittsburg\t(84) 99999-0000"}
              className="font-mono text-xs"
              disabled={busy}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Importar para</Label>
              <Select value={target} onValueChange={setTarget} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Nova lista</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Sem lista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {target === "new" && (
              <div className="grid gap-1.5">
                <Label htmlFor="import-new">Nome da nova lista *</Label>
                <Input
                  id="import-new"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: Indicações PTPJ 26.3"
                  disabled={busy}
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={skipDupes}
              onCheckedChange={(v) => setSkipDupes(v === true)}
              disabled={busy}
            />
            Ignorar telefones que já estão no banco (ou repetidos na lista)
          </label>

          {parsed.rows.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{prepared.rows.length}</span> leads
                prontos
                {prepared.dupes > 0 && ` · ${prepared.dupes} repetidos ignorados`}
                {" · "}colunas: {fields.map((f) => IMPORT_FIELD_LABEL[f]).join(", ")}
                {!parsed.hasHeader && " (sem cabeçalho)"}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 text-left font-medium">Nome</th>
                      <th className="py-1 pr-3 text-left font-medium">Empresa</th>
                      <th className="py-1 pr-3 text-left font-medium">Telefone</th>
                      <th className="py-1 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="max-w-40 truncate py-1 pr-3">{r.nome}</td>
                        <td className="max-w-40 truncate py-1 pr-3">{r.empresa ?? "—"}</td>
                        <td className="whitespace-nowrap py-1 pr-3">{r.telefone ?? "—"}</td>
                        <td className="py-1">
                          <StatusPill status={r.status} className="h-5 w-32 rounded" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {busy && (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(100 * (progress ?? 0)) / Math.max(1, prepared.rows.length)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Importando {progress} de {prepared.rows.length}…
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={run} disabled={!canImport}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Importar {prepared.rows.length > 0 ? prepared.rows.length : ""} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
