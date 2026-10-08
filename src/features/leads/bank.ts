/**
 * Banco de Leads: base de contatos registrada em massa (listas, importações e,
 * no futuro, automações). O status "Reunião marcada" com data envia o lead
 * para o Kanban — a automação roda no banco (gatilho em lead_bank).
 */
import type { Database } from "@/integrations/supabase/types";

export type BankLead = Database["public"]["Tables"]["lead_bank"]["Row"];
export type BankGroup = Database["public"]["Tables"]["lead_bank_groups"]["Row"];

export type BankStatus =
  | "novo_lead"
  | "numero_errado"
  | "nao_atendeu"
  | "reuniao_marcada"
  | "retornar"
  | "sem_interesse"
  | "sem_budget"
  | "sem_demanda"
  | "sem_empresa"
  | "parceria"
  | "fluxo_finalizado"
  | "desqualificado"
  | "cliente_atual"
  | "timing_errado"
  | "em_fluxo"
  | "numero_protegido"
  | "primeiro_contato"
  | "redirecionou"
  | "repetido"
  | "numero_comercial";

/** Em aberto: ainda em prospecção. Convertido: foi para o Kanban. */
export type BankPhase = "aberto" | "convertido" | "encerrado";

export const MEETING_STATUS: BankStatus = "reuniao_marcada";

/** Cor da etiqueta "sem status". */
export const EMPTY_STATUS_COLOR = "#7a7e91";

/**
 * Etiquetas na mesma ordem e cores do quadro usado hoje pelo time
 * (preenchidas coluna a coluna, seis por coluna).
 */
export const BANK_STATUSES: { key: BankStatus; label: string; color: string; phase: BankPhase }[] =
  [
    { key: "novo_lead", label: "Novo lead", color: "#f3bf72", phase: "aberto" },
    { key: "numero_errado", label: "Número Errado", color: "#f5c0be", phase: "encerrado" },
    { key: "nao_atendeu", label: "Não Atendeu", color: "#ef8a62", phase: "aberto" },
    { key: "reuniao_marcada", label: "Reunião Marcada", color: "#b9db66", phase: "convertido" },
    { key: "retornar", label: "Retornar", color: "#bb6276", phase: "aberto" },
    { key: "sem_interesse", label: "Sem Interesse", color: "#d8707f", phase: "encerrado" },
    { key: "sem_budget", label: "Sem Budget", color: "#539773", phase: "encerrado" },
    { key: "sem_demanda", label: "Sem Demanda", color: "#85aef7", phase: "encerrado" },
    { key: "sem_empresa", label: "Sem Empresa", color: "#ad7fdd", phase: "encerrado" },
    { key: "parceria", label: "Parceria", color: "#f8d757", phase: "encerrado" },
    { key: "fluxo_finalizado", label: "Fluxo Finalizado", color: "#549cc9", phase: "encerrado" },
    { key: "desqualificado", label: "DESQUALIFICADO", color: "#d2c674", phase: "encerrado" },
    { key: "cliente_atual", label: "Cliente atual", color: "#93766e", phase: "encerrado" },
    { key: "timing_errado", label: "Timing Errado", color: "#5c5c5c", phase: "encerrado" },
    { key: "em_fluxo", label: "Em Fluxo", color: "#6146a3", phase: "aberto" },
    { key: "numero_protegido", label: "Número protegido", color: "#ee82cc", phase: "encerrado" },
    {
      key: "primeiro_contato",
      label: "Primeiro Ponto de Contato",
      color: "#98d4fb",
      phase: "aberto",
    },
    { key: "redirecionou", label: "Redirecionou p/ Outro", color: "#2c5962", phase: "aberto" },
    { key: "repetido", label: "Repetido", color: "#baa9f3", phase: "encerrado" },
    { key: "numero_comercial", label: "Número comercial", color: "#8d70d4", phase: "aberto" },
  ];

const BY_KEY = new Map(BANK_STATUSES.map((s) => [s.key, s]));

export function bankStatusMeta(status: string | null | undefined) {
  return status ? (BY_KEY.get(status as BankStatus) ?? null) : null;
}

export function bankStatusLabel(status: string | null | undefined) {
  return bankStatusMeta(status)?.label ?? "Sem status";
}

export function bankStatusColor(status: string | null | undefined) {
  return bankStatusMeta(status)?.color ?? EMPTY_STATUS_COLOR;
}

/** Sem status conta como em aberto (ninguém falou com o lead ainda). */
export function bankPhase(status: string | null | undefined): BankPhase {
  return bankStatusMeta(status)?.phase ?? "aberto";
}

/** Tinta de maior contraste sobre a etiqueta (escura nas cores claras). */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Acima de ~0,2 de luminância a tinta escura contrasta mais que o branco.
  return lum > 0.2 ? "#141824" : "#ffffff";
}

export const GROUP_COLORS = [
  "#579bfc",
  "#ffcb00",
  "#00c875",
  "#e2445c",
  "#a25ddc",
  "#ff7575",
  "#66ccff",
  "#fdab3d",
];

/** Contagem por status, na ordem das etiquetas (para a barra de resumo). */
export function statusBreakdown(leads: Pick<BankLead, "status">[]) {
  const counts = new Map<string, number>();
  leads.forEach((l) => counts.set(l.status ?? "", (counts.get(l.status ?? "") ?? 0) + 1));
  const out = BANK_STATUSES.filter((s) => counts.get(s.key)).map((s) => ({
    key: s.key as string,
    label: s.label,
    color: s.color,
    count: counts.get(s.key)!,
  }));
  if (counts.get("")) {
    out.push({ key: "", label: "Sem status", color: EMPTY_STATUS_COLOR, count: counts.get("")! });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Importação de listas (colar da planilha ou arquivo CSV)            */
/* ------------------------------------------------------------------ */

export function normalizeText(v: string | null | undefined) {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizePhone(v: string | null | undefined) {
  const digits = (v ?? "").replace(/\D/g, "");
  // Ignora o DDI do Brasil para comparar "5511..." com "11...".
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

export type ImportField =
  "nome" | "empresa" | "telefone" | "status" | "contato_por" | "observacoes";

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  nome: "Nome",
  empresa: "Empresa",
  telefone: "Telefone",
  status: "Status do lead",
  contato_por: "Quem entrou em contato",
  observacoes: "Observações",
};

const HEADER_ALIASES: Record<ImportField, string[]> = {
  nome: ["nome", "name", "nome do lead", "lead", "nome da pessoa", "pessoa", "nome do contato"],
  empresa: ["empresa", "nome da empresa", "company", "razao social", "nome fantasia"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "phone", "numero", "telefone/whatsapp"],
  status: ["status", "status do lead", "etiqueta"],
  contato_por: [
    "sdr",
    "sdr responsavel",
    "responsavel",
    "quem entrou em contato",
    "contato por",
    "pessoa responsavel",
  ],
  observacoes: ["observacoes", "observacao", "obs", "notas", "comentarios"],
};

function splitLine(line: string, sep: string) {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") quoted = true;
    else if (ch === sep) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Junta linhas quebradas dentro de aspas (comuns em observações). */
function logicalLines(text: string) {
  const out: string[] = [];
  let buf = "";
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    buf = buf ? `${buf}\n${raw}` : raw;
    if ((buf.match(/"/g)?.length ?? 0) % 2 === 0) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out.filter((l) => l.trim() !== "");
}

export type ParsedImport = {
  /** Coluna de origem de cada campo reconhecido. */
  columns: Partial<Record<ImportField, number>>;
  hasHeader: boolean;
  rows: Partial<Record<ImportField, string>>[];
};

export function parseLeadList(text: string): ParsedImport {
  const lines = logicalLines(text);
  if (!lines.length) return { columns: {}, hasHeader: false, rows: [] };
  const first = lines[0];
  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const table = lines.map((l) => splitLine(l, sep));

  const columns: Partial<Record<ImportField, number>> = {};
  table[0].forEach((cell, i) => {
    const h = normalizeText(cell).replace(/[:*]/g, "").trim();
    for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
      if (columns[field] === undefined && HEADER_ALIASES[field].includes(h)) {
        columns[field] = i;
        break;
      }
    }
  });
  const hasHeader = columns.nome !== undefined;
  if (!hasHeader) {
    // Sem cabeçalho: Nome, Empresa, Telefone, nessa ordem.
    for (const k of Object.keys(columns) as ImportField[]) delete columns[k];
    columns.nome = 0;
    if (table.some((r) => r.length > 1)) columns.empresa = 1;
    if (table.some((r) => r.length > 2)) columns.telefone = 2;
  }

  const rows = (hasHeader ? table.slice(1) : table)
    .map((cells) => {
      const row: Partial<Record<ImportField, string>> = {};
      for (const [field, idx] of Object.entries(columns) as [ImportField, number][]) {
        const v = cells[idx]?.trim();
        if (v) row[field] = v;
      }
      return row;
    })
    .filter((r) => r.nome);
  return { columns, hasHeader, rows };
}

/** Aceita o nome da etiqueta (com ou sem acento, até cortado) ou a chave. */
export function matchBankStatus(v: string | null | undefined): BankStatus | null {
  const n = normalizeText(v).replace(/[\\]/g, "/");
  if (!n) return null;
  for (const s of BANK_STATUSES) {
    const label = normalizeText(s.label);
    if (n === s.key || n === label) return s.key;
  }
  const cut = n.replace(/\.{2,}|…$/g, "").trim();
  if (cut.length >= 4) {
    const hit = BANK_STATUSES.find((s) => normalizeText(s.label).startsWith(cut));
    if (hit) return hit.key;
  }
  return null;
}

/** Texto para arquivo CSV (separado por ponto e vírgula, como o Excel em pt-BR). */
export function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const lines = rows.map((r) => r.map(csvCell).join(";"));
  // BOM para o Excel abrir os acentos corretamente.
  const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
