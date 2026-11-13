/** Sucesso do Cliente: rótulos, cores e regras simples usadas na aba e no painel. */

export type Farol = "verde" | "amarelo" | "vermelho";
export type RegistroTipo = "contato" | "reuniao" | "nps" | "csat";
export type IndicacaoStatus = "nova" | "em_contato" | "proposta" | "fechada" | "perdida";

export type ProjectCS = {
  project_id: string;
  farol: Farol | null;
  farol_motivo: string | null;
  responsavel_id: string | null;
  proximo_contato: string | null;
  updated_at: string;
};

export type Registro = {
  id: string;
  project_id: string;
  tipo: RegistroTipo;
  data: string;
  nota: number | null;
  comentario: string | null;
  autor_id: string | null;
  created_at: string;
};

export type Indicacao = {
  id: string;
  project_id: string;
  empresa: string;
  contato: string | null;
  telefone: string | null;
  status: IndicacaoStatus;
  observacoes: string | null;
  autor_id: string | null;
  created_at: string;
};

export const FAROL_META: Record<
  Farol,
  { label: string; hint: string; dot: string; chip: string; ring: string }
> = {
  verde: {
    label: "Verde",
    hint: "Tudo certo",
    dot: "bg-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    ring: "ring-emerald-400/60 bg-emerald-500/15 text-emerald-200",
  },
  amarelo: {
    label: "Amarelo",
    hint: "Pede atenção",
    dot: "bg-amber-400",
    chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    ring: "ring-amber-400/60 bg-amber-500/15 text-amber-200",
  },
  vermelho: {
    label: "Vermelho",
    hint: "Risco: agir agora",
    dot: "bg-red-400",
    chip: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    ring: "ring-red-400/60 bg-red-500/15 text-red-200",
  },
};
export const FAROIS: Farol[] = ["verde", "amarelo", "vermelho"];

export const REGISTRO_META: Record<RegistroTipo, { label: string; acao: string }> = {
  contato: { label: "Contato", acao: "Registrar contato" },
  reuniao: { label: "Reunião", acao: "Registrar reunião" },
  nps: { label: "NPS", acao: "Registrar NPS" },
  csat: { label: "CSAT", acao: "Registrar CSAT" },
};

export const INDICACAO_META: Record<IndicacaoStatus, { label: string; chip: string }> = {
  nova: { label: "Nova", chip: "bg-primary/15 text-primary ring-1 ring-primary/30" },
  em_contato: { label: "Em contato", chip: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" },
  proposta: { label: "Proposta", chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30" },
  fechada: {
    label: "Virou venda",
    chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  },
  perdida: { label: "Perdida", chip: "bg-muted text-muted-foreground ring-1 ring-border/50" },
};
export const INDICACAO_STATUS: IndicacaoStatus[] = [
  "nova",
  "em_contato",
  "proposta",
  "fechada",
  "perdida",
];

/** Cor da nota: NPS 0–6 detrator, 7–8 neutro, 9–10 promotor; CSAT 1–2 ruim, 3 regular, 4–5 bom. */
export function notaTom(tipo: RegistroTipo, nota: number | null): "bom" | "medio" | "ruim" | null {
  if (nota == null) return null;
  if (tipo === "nps") return nota >= 9 ? "bom" : nota >= 7 ? "medio" : "ruim";
  if (tipo === "csat") return nota >= 4 ? "bom" : nota >= 3 ? "medio" : "ruim";
  return null;
}
export const TOM_CLASSE = {
  bom: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  medio: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  ruim: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
} as const;

/** Data de hoje (fuso local) no formato do banco: AAAA-MM-DD. */
export function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Dias entre hoje e a data (negativo = já passou). */
export function diasAte(data: string) {
  const alvo = new Date(`${data.slice(0, 10)}T00:00:00`);
  const hoje = new Date(`${hojeISO()}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function formatarData(data: string) {
  return new Date(`${data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

/** Texto curto para o próximo contato: "hoje", "amanhã", "em 3 dias", "atrasado há 2 dias". */
export function textoProximoContato(data: string | null) {
  if (!data) return null;
  const d = diasAte(data);
  if (d < 0) return `atrasado há ${-d} dia${d === -1 ? "" : "s"}`;
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

/** Erro de tabela inexistente (migração ainda não aplicada no banco). */
export function tabelaAusente(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}
