import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownUp, Download, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeads, usePeopleMap } from "@/features/leads/api";
import { useLeadFilters } from "@/features/leads/filters";
import { LeadFiltersBar, PageHeader } from "@/features/leads/components/LeadFilters";
import { LeadFormDialog } from "@/features/leads/components/LeadFormDialog";
import { DueBadge, OwnerChip, StageBadge } from "@/features/leads/components/shared";
import { formatDate, localDate } from "@/features/leads/format";
import { canalLabel, isFinalStage, ownerName, stageLabel, type Lead } from "@/features/leads/model";

export const Route = createFileRoute("/_authenticated/leads/banco")({
  beforeLoad: ({ context }) => {
    if (!context.hasCommercial) throw redirect({ to: "/dashboard" });
  },
  component: BancoDeLeadsPage,
});

type Sort = "recentes" | "nome" | "proxima_acao";

const SORTS: Record<Sort, { label: string; fn: (a: Lead, b: Lead) => number }> = {
  recentes: { label: "Mais recentes", fn: (a, b) => b.created_at.localeCompare(a.created_at) },
  nome: { label: "Nome (A–Z)", fn: (a, b) => a.nome.localeCompare(b.nome, "pt-BR") },
  proxima_acao: {
    label: "Próxima ação",
    fn: (a, b) => (a.data_lembrete ?? "9999").localeCompare(b.data_lembrete ?? "9999"),
  },
};

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function BancoDeLeadsPage() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeads();
  const { data: people = {} } = usePeopleMap(leads.map((l) => l.responsavel_id));
  const { filters, set, filtered } = useLeadFilters(leads);
  const [sort, setSort] = useState<Sort>("recentes");
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => [...filtered].sort(SORTS[sort].fn), [filtered, sort]);
  const openLead = (l: Lead) => navigate({ to: "/leads/$id", params: { id: l.id } });

  function exportCsv() {
    const header = [
      "Nome",
      "Empresa",
      "Telefone",
      "Contato",
      "Canal de origem",
      "Detalhe da origem",
      "Etapa",
      "Responsável",
      "Próxima ação",
      "Data da próxima ação",
      "Valor estimado",
      "Cadastrado em",
    ];
    const lines = rows.map((l) =>
      [
        l.nome,
        l.empresa,
        l.telefone,
        l.contato,
        canalLabel(l.canal_origem),
        l.origem,
        stageLabel(l.etapa),
        ownerName(l, people),
        l.proximo_passo,
        l.data_lembrete,
        l.valor_estimado,
        localDate(l.created_at),
      ]
        .map(csvCell)
        .join(";"),
    );
    // BOM para o Excel abrir os acentos corretamente.
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Acompanhamento de Leads"
        title="Banco de Leads"
        description="Todos os leads cadastrados, com origem, etapa e responsável."
        actions={
          <>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={exportCsv}
              disabled={!rows.length}
            >
              <Download className="size-4" /> Exportar CSV
            </Button>
            <Button className="gap-2" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" /> Cadastrar lead
            </Button>
          </>
        }
      />

      <LeadFiltersBar filters={filters} set={set} isAdmin={isAdmin} showCanal showAction={false}>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() =>
            setSort(sort === "recentes" ? "nome" : sort === "nome" ? "proxima_acao" : "recentes")
          }
        >
          <ArrowDownUp className="size-4" /> {SORTS[sort].label}
        </Button>
      </LeadFiltersBar>

      <p className="text-xs text-muted-foreground">
        {rows.length} de {leads.length} lead{leads.length === 1 ? "" : "s"}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</p>
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="space-y-2 md:hidden">
            {rows.map((l) => (
              <button
                key={l.id}
                onClick={() => openLead(l)}
                className="w-full rounded-xl border border-border/50 bg-card/50 p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[l.empresa, l.telefone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {!isFinalStage(l.etapa) && <DueBadge date={l.data_lembrete} />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StageBadge etapa={l.etapa} subetapa={l.subetapa} />
                  {canalLabel(l.canal_origem) && (
                    <span className="text-[11px] text-muted-foreground">
                      {canalLabel(l.canal_origem)}
                    </span>
                  )}
                </div>
                <OwnerChip lead={l} people={people} className="mt-2" />
              </button>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-xl border border-border/50 bg-card/50 backdrop-blur md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Próxima ação</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => openLead(l)}>
                    <TableCell className="max-w-56">
                      <p className="truncate text-sm font-medium">{l.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.empresa ?? "—"}</p>
                    </TableCell>
                    <TableCell className="max-w-44 text-xs text-muted-foreground">
                      <p className="truncate">{l.telefone ?? "—"}</p>
                      {l.contato && <p className="truncate">{l.contato}</p>}
                    </TableCell>
                    <TableCell className="max-w-40 text-xs text-muted-foreground">
                      <p className="truncate">{canalLabel(l.canal_origem) ?? "—"}</p>
                      {l.origem && <p className="truncate">{l.origem}</p>}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <StageBadge etapa={l.etapa} subetapa={l.subetapa} />
                    </TableCell>
                    <TableCell>
                      <OwnerChip lead={l} people={people} />
                    </TableCell>
                    <TableCell className="max-w-60">
                      {isFinalStage(l.etapa) ? (
                        <span className="text-xs text-muted-foreground">Encerrado</span>
                      ) : (
                        <div className="space-y-1">
                          <DueBadge date={l.data_lembrete} />
                          {l.proximo_passo && (
                            <p className="truncate text-xs text-muted-foreground">
                              {l.proximo_passo}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(l.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={null}
        userId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
