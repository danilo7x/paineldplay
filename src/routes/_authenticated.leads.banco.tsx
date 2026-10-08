import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Download,
  FileUp,
  FolderPlus,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommercialPeople, usePeopleMap } from "@/features/leads/api";
import {
  BANK_STATUSES,
  MEETING_STATUS,
  bankPhase,
  bankStatusLabel,
  downloadCsv,
  normalizePhone,
  normalizeText,
  type BankGroup,
  type BankLead,
  type BankStatus,
} from "@/features/leads/bank";
import {
  useBankGroups,
  useBankLeads,
  useCreateBankLeads,
  useDeleteBankGroup,
  useDeleteBankLeads,
  useUpdateBankLeads,
  type BankPatch,
} from "@/features/leads/bank-api";
import { StatusGrid } from "@/features/leads/components/bank/BankCells";
import {
  BankLeadDialog,
  GroupDialog,
  ImportDialog,
  MeetingDialog,
} from "@/features/leads/components/bank/BankDialogs";
import {
  BankGroupSection,
  type BankRowActions,
} from "@/features/leads/components/bank/BankGroupSection";
import { PageHeader } from "@/features/leads/components/LeadFilters";

export const Route = createFileRoute("/_authenticated/leads/banco")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: BancoDeLeadsPage,
});

type Sort = "recentes" | "nome";
const NO_GROUP = "none";

function BancoDeLeadsPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: leads = [], isLoading, error } = useBankLeads();
  const { data: groups = [] } = useBankGroups();
  const { data: people = [] } = useCommercialPeople();
  const { data: peopleMap = {} } = usePeopleMap(leads.map((l) => l.contato_por));
  const update = useUpdateBankLeads();
  const create = useCreateBankLeads();
  const removeLeads = useDeleteBankLeads();
  const removeGroup = useDeleteBankGroup();

  const [search, setSearch] = useState("");
  const [person, setPerson] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [groupFilter, setGroupFilter] = useState("todas");
  const [sort, setSort] = useState<Sort>("recentes");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [leadDialog, setLeadDialog] = useState<{
    lead: BankLead | null;
    groupId?: string | null;
  } | null>(null);
  const [meetingFor, setMeetingFor] = useState<BankLead | null>(null);
  const [groupDialog, setGroupDialog] = useState<{ group: BankGroup | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<BankGroup | null>(null);

  const nextOrder = groups.reduce((m, g) => Math.max(m, g.ordem + 1), 0);
  const filtering =
    !!search.trim() || person !== "todos" || status !== "todos" || groupFilter !== "todas";

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    const qPhone = normalizePhone(search);
    const rows = leads.filter((l) => {
      if (q) {
        const hay = normalizeText([l.nome, l.empresa, l.telefone].filter(Boolean).join(" "));
        const phoneHit = qPhone.length >= 4 && normalizePhone(l.telefone).includes(qPhone);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      if (person === "sem" && l.contato_por) return false;
      if (!["todos", "sem"].includes(person) && l.contato_por !== person) return false;
      if (status === "sem_status" && l.status) return false;
      if (["aberto", "encerrado", "convertido"].includes(status) && bankPhase(l.status) !== status)
        return false;
      if (
        !["todos", "sem_status", "aberto", "encerrado", "convertido"].includes(status) &&
        l.status !== status
      )
        return false;
      if (groupFilter === NO_GROUP && l.grupo_id) return false;
      if (!["todas", NO_GROUP].includes(groupFilter) && l.grupo_id !== groupFilter) return false;
      return true;
    });
    if (sort === "nome") rows.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return rows;
  }, [leads, search, person, status, groupFilter, sort]);

  const sections = useMemo(() => {
    const byGroup = new Map<string, BankLead[]>();
    const known = new Set(groups.map((g) => g.id));
    filtered.forEach((l) => {
      const key = l.grupo_id && known.has(l.grupo_id) ? l.grupo_id : NO_GROUP;
      const arr = byGroup.get(key) ?? [];
      arr.push(l);
      byGroup.set(key, arr);
    });
    const list: { group: BankGroup | null; leads: BankLead[] }[] = groups
      .filter((g) => groupFilter === "todas" || groupFilter === g.id)
      .map((g) => ({ group: g, leads: byGroup.get(g.id) ?? [] }))
      .filter((s) => !filtering || s.leads.length > 0);
    const loose = byGroup.get(NO_GROUP);
    if (loose?.length) list.push({ group: null, leads: loose });
    return list;
  }, [filtered, groups, groupFilter, filtering]);

  const stats = useMemo(() => {
    let aberto = 0;
    let reunioes = 0;
    let kanban = 0;
    leads.forEach((l) => {
      if (bankPhase(l.status) === "aberto") aberto++;
      if (l.status === MEETING_STATUS) reunioes++;
      if (l.lead_id) kanban++;
    });
    return { total: leads.length, aberto, reunioes, kanban };
  }, [leads]);

  const selectedLeads = useMemo(() => leads.filter((l) => selected.has(l.id)), [leads, selected]);

  /** Quem muda o status de um lead sem dono passa a ser quem entrou em contato. */
  function claim(lead: BankLead, next: string | null): BankPatch {
    return !lead.contato_por && next && next !== "novo_lead" ? { contato_por: user.id } : {};
  }

  const canOpenKanban = (l: BankLead) => !!l.lead_id && (isAdmin || l.contato_por === user.id);

  function announceMeeting(saved: BankLead) {
    const who = saved.contato_por ? peopleMap[saved.contato_por]?.nome : null;
    toast.success("Reunião marcada · lead enviado ao Kanban", {
      description: who && saved.contato_por !== user.id ? `No Kanban de ${who}.` : undefined,
      action: canOpenKanban(saved)
        ? {
            label: "Abrir",
            onClick: () => navigate({ to: "/leads/$id", params: { id: saved.lead_id! } }),
          }
        : undefined,
    });
  }

  const actions: BankRowActions = {
    update: (lead, patch) => update.mutate({ ids: [lead.id], patch }),
    changeStatus: (lead, next) => {
      if (next === MEETING_STATUS) {
        setMeetingFor(lead);
        return;
      }
      update.mutate({ ids: [lead.id], patch: { status: next, ...claim(lead, next) } });
    },
    editMeeting: (lead) => setMeetingFor(lead),
    edit: (lead) => setLeadDialog({ lead }),
    remove: (lead) => setConfirmDelete([lead.id]),
    quickAdd: (groupId, nome) =>
      create.mutate({ rows: [{ nome, grupo_id: groupId, created_by: user.id }] }),
  };

  async function confirmMeeting(at: Date) {
    if (!meetingFor) return;
    try {
      const [saved] = await update.mutateAsync({
        ids: [meetingFor.id],
        patch: {
          status: MEETING_STATUS,
          reuniao_em: at.toISOString(),
          ...claim(meetingFor, MEETING_STATUS),
        },
      });
      setMeetingFor(null);
      if (saved?.lead_id) announceMeeting(saved);
    } catch {
      // O aviso de erro já foi mostrado.
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(ids: string[], on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function bulk(patch: BankPatch, label: string) {
    let ids = selectedLeads.map((l) => l.id);
    if (patch.contato_por !== undefined && !isAdmin) {
      // Colaborador não mexe em contatos de outra pessoa.
      ids = selectedLeads
        .filter((l) => !l.contato_por || l.contato_por === user.id)
        .map((l) => l.id);
      const skipped = selectedLeads.length - ids.length;
      if (skipped) toast.info(`${skipped} leads de outras pessoas foram mantidos`);
    }
    if (!ids.length) return;
    update.mutate(
      { ids, patch, success: `${ids.length} ${ids.length === 1 ? "lead" : "leads"}: ${label}` },
      { onSuccess: () => setSelected(new Set()) },
    );
  }

  function exportCsv() {
    const groupName = new Map(groups.map((g) => [g.id, g.nome]));
    downloadCsv(
      `banco-de-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Lista",
        "Nome",
        "Empresa",
        "Telefone",
        "Quem entrou em contato",
        "Status do lead",
        "Data da reunião",
        "No Kanban",
        "Observações",
        "Cadastrado em",
      ],
      filtered.map((l) => [
        (l.grupo_id && groupName.get(l.grupo_id)) || "Sem lista",
        l.nome,
        l.empresa,
        l.telefone,
        l.contato_por ? (peopleMap[l.contato_por]?.nome ?? peopleMap[l.contato_por]?.email) : "",
        l.status ? bankStatusLabel(l.status) : "",
        l.reuniao_em ? new Date(l.reuniao_em).toLocaleString("pt-BR") : "",
        l.lead_id ? "Sim" : "",
        l.observacoes,
        l.created_at.slice(0, 10),
      ]),
    );
  }

  const assignable = isAdmin ? people : people.filter((p) => p.id === user.id);

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Banco de Leads"
        description="Registre leads em massa, organize por listas e acompanhe cada contato. Reunião marcada vai direto para o Kanban."
        actions={
          <>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={exportCsv}
              disabled={!filtered.length}
            >
              <Download className="size-4" /> Exportar
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <FileUp className="size-4" /> Importar lista
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setGroupDialog({ group: null })}
            >
              <FolderPlus className="size-4" /> Nova lista
            </Button>
            <Button className="gap-2" onClick={() => setLeadDialog({ lead: null })}>
              <Plus className="size-4" /> Adicionar lead
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads no banco" value={stats.total} />
        <Stat label="Em aberto" value={stats.aberto} hint="ainda em prospecção" />
        <Stat label="Reunião marcada" value={stats.reunioes} />
        <Stat label="Enviados ao Kanban" value={stats.kanban} />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa ou telefone"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger className="lg:w-48">
              <UserRound className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as pessoas</SelectItem>
              <SelectItem value={user.id}>Meus contatos</SelectItem>
              <SelectItem value="sem">Ninguém ainda</SelectItem>
              {people
                .filter((p) => p.id !== user.id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome ?? p.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="convertido">Reunião marcada</SelectItem>
              <SelectItem value="encerrado">Encerrados</SelectItem>
              <SelectItem value="sem_status">Sem status</SelectItem>
              {BANK_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as listas</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nome}
                </SelectItem>
              ))}
              <SelectItem value={NO_GROUP}>Sem lista</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setSort(sort === "recentes" ? "nome" : "recentes")}
          >
            <ArrowDownUp className="size-4" />{" "}
            {sort === "recentes" ? "Mais recentes" : "Nome (A–Z)"}
          </Button>
        </div>
      </div>

      {filtering && (
        <p className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} de {leads.length.toLocaleString("pt-BR")} leads
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar o Banco de Leads: {(error as Error).message}
        </p>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {filtering
              ? "Nenhum lead com esses filtros."
              : "O banco está vazio. Crie uma lista ou importe uma planilha para começar."}
          </p>
          {!filtering && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <FileUp className="size-4" /> Importar lista
              </Button>
              <Button className="gap-2" onClick={() => setGroupDialog({ group: null })}>
                <FolderPlus className="size-4" /> Nova lista
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((s) => (
            <BankGroupSection
              key={s.group?.id ?? NO_GROUP}
              group={s.group}
              leads={s.leads}
              people={people}
              peopleMap={peopleMap}
              userId={user.id}
              isAdmin={isAdmin}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              actions={actions}
              onAddLead={() => setLeadDialog({ lead: null, groupId: s.group?.id ?? null })}
              onEditGroup={s.group ? () => setGroupDialog({ group: s.group }) : undefined}
              onDeleteGroup={s.group && isAdmin ? () => setConfirmGroup(s.group) : undefined}
            />
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur sm:inset-x-6">
          <span className="px-2 text-sm font-medium">
            {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary">
                Alterar status
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" side="top">
              <StatusGrid
                exclude={[MEETING_STATUS]}
                onSelect={(s: BankStatus | null) => bulk({ status: s }, bankStatusLabel(s))}
              />
              <p className="mt-2 max-w-xs text-[11px] text-muted-foreground">
                “Reunião Marcada” precisa de data: marque um lead por vez.
              </p>
            </PopoverContent>
          </Popover>
          <Select
            value=""
            onValueChange={(v) =>
              bulk(
                { contato_por: v === "none" ? null : v },
                v === "none" ? "sem contato" : "atribuídos",
              )
            }
          >
            <SelectTrigger className="h-8 w-auto gap-2 text-xs">
              <SelectValue placeholder="Quem entrou em contato" />
            </SelectTrigger>
            <SelectContent>
              {assignable.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome ?? p.email}
                  {p.id === user.id ? " (você)" : ""}
                </SelectItem>
              ))}
              <SelectItem value="none">Remover</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value=""
            onValueChange={(v) => bulk({ grupo_id: v === NO_GROUP ? null : v }, "movidos")}
          >
            <SelectTrigger className="h-8 w-auto gap-2 text-xs">
              <SelectValue placeholder="Mover para lista" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nome}
                </SelectItem>
              ))}
              <SelectItem value={NO_GROUP}>Sem lista</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete([...selected])}
          >
            <Trash2 className="size-4" /> Excluir
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-8"
            onClick={() => setSelected(new Set())}
            aria-label="Limpar seleção"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <BankLeadDialog
        open={!!leadDialog}
        onOpenChange={(v) => !v && setLeadDialog(null)}
        lead={leadDialog?.lead ?? null}
        defaultGroupId={
          leadDialog?.groupId !== undefined ? leadDialog.groupId : (groups[0]?.id ?? null)
        }
        groups={groups}
        people={people}
        userId={user.id}
        isAdmin={isAdmin}
        onMeetingSaved={announceMeeting}
      />
      <MeetingDialog
        open={!!meetingFor}
        onOpenChange={(v) => !v && setMeetingFor(null)}
        leadName={meetingFor?.nome ?? ""}
        current={meetingFor?.status === MEETING_STATUS ? (meetingFor.reuniao_em ?? null) : null}
        pending={update.isPending}
        onConfirm={confirmMeeting}
      />
      <GroupDialog
        open={!!groupDialog}
        onOpenChange={(v) => !v && setGroupDialog(null)}
        group={groupDialog?.group ?? null}
        nextOrder={nextOrder}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        groups={groups}
        leads={leads}
        people={people}
        userId={user.id}
        isAdmin={isAdmin}
        nextOrder={nextOrder}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {confirmDelete?.length === 1 ? "este lead" : `${confirmDelete?.length} leads`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sai apenas do Banco de Leads; leads que já estão no Kanban continuam lá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const ids = confirmDelete ?? [];
                removeLeads.mutate(ids, {
                  onSuccess: (removed) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      removed.forEach((id) => next.delete(id));
                      return next;
                    }),
                });
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmGroup} onOpenChange={(v) => !v && setConfirmGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a lista “{confirmGroup?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os leads não são apagados: eles passam para “Sem lista”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmGroup) removeGroup.mutate(confirmGroup.id);
                setConfirmGroup(null);
              }}
            >
              Excluir lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value.toLocaleString("pt-BR")}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
