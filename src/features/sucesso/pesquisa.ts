/**
 * Pesquisas de satisfação, no formato dos dois roteiros de reunião da DPlay:
 * - Reunião de Coleta de Satisfação Geral (durante o projeto)
 * - Reunião de Alinhamento Final (RAF), no encerramento
 */
import { diasAte } from "./meta";

export type PesquisaTipo = "coleta" | "raf";

export type PerguntaChave =
  | "comunicacao"
  | "andamento"
  | "qualidade_servico"
  | "qualidade_entregaveis"
  | "facilidade_uso"
  | "impacto"
  | "satisfacao_geral";

export type Interesse = "automacao_ia" | "sistemas_erp" | "ecommerce" | "websites" | "branding";

export type Pesquisa = {
  id: string;
  project_id: string;
  tipo: PesquisaTipo;
  data: string;
  nps: number | null;
  funcionou_bem: string | null;
  melhorar: string | null;
  sugestoes: string | null;
  meses_acompanhamento: number | null;
  interesses: Interesse[];
  autor_id: string | null;
  created_at: string;
} & Record<PerguntaChave, number | null>;

export const PESQUISA_META: Record<
  PesquisaTipo,
  {
    titulo: string;
    curto: string;
    quando: string;
    perguntas: { chave: PerguntaChave; texto: string }[];
  }
> = {
  coleta: {
    titulo: "Coleta de satisfação",
    curto: "Coleta",
    quando: "Durante o projeto",
    perguntas: [
      { chave: "comunicacao", texto: "Relacionamento e comunicação com a equipe" },
      { chave: "andamento", texto: "Andamento das atividades" },
      { chave: "qualidade_servico", texto: "Qualidade do serviço prestado" },
    ],
  },
  raf: {
    titulo: "Alinhamento final (RAF)",
    curto: "RAF",
    quando: "No encerramento do projeto",
    perguntas: [
      { chave: "qualidade_entregaveis", texto: "Qualidade dos entregáveis" },
      { chave: "facilidade_uso", texto: "Facilidade no uso das ferramentas" },
      { chave: "comunicacao", texto: "Comunicação com a equipe" },
      { chave: "impacto", texto: "Impacto do projeto na empresa" },
      { chave: "satisfacao_geral", texto: "Satisfação com o projeto" },
    ],
  },
};

/** Temas usados no painel para mostrar onde a DPlay vai bem e onde precisa melhorar. */
export const TEMAS: { label: string; chaves: PerguntaChave[] }[] = [
  { label: "Comunicação", chaves: ["comunicacao"] },
  { label: "Andamento", chaves: ["andamento"] },
  { label: "Qualidade", chaves: ["qualidade_servico", "qualidade_entregaveis"] },
  { label: "Facilidade de uso", chaves: ["facilidade_uso"] },
  { label: "Impacto no negócio", chaves: ["impacto"] },
  { label: "Satisfação geral", chaves: ["satisfacao_geral"] },
];

export const TODAS_PERGUNTAS: PerguntaChave[] = [
  "comunicacao",
  "andamento",
  "qualidade_servico",
  "qualidade_entregaveis",
  "facilidade_uso",
  "impacto",
  "satisfacao_geral",
];

/** Escala das carinhas, igual à dos slides. */
export const ESCALA: { nota: number; label: string; emoji: string; cor: string; ativo: string }[] =
  [
    {
      nota: 1,
      label: "Muito insatisfeito",
      emoji: "😞",
      cor: "text-red-300",
      ativo: "bg-red-500/20 ring-red-400/70",
    },
    {
      nota: 2,
      label: "Insatisfeito",
      emoji: "🙁",
      cor: "text-orange-300",
      ativo: "bg-orange-500/20 ring-orange-400/70",
    },
    {
      nota: 3,
      label: "Neutro",
      emoji: "😐",
      cor: "text-amber-300",
      ativo: "bg-amber-500/20 ring-amber-400/70",
    },
    {
      nota: 4,
      label: "Satisfeito",
      emoji: "🙂",
      cor: "text-lime-300",
      ativo: "bg-lime-500/20 ring-lime-400/70",
    },
    {
      nota: 5,
      label: "Muito satisfeito",
      emoji: "😄",
      cor: "text-emerald-300",
      ativo: "bg-emerald-500/20 ring-emerald-400/70",
    },
  ];

export const INTERESSES: { chave: Interesse; label: string; hint: string }[] = [
  { chave: "automacao_ia", label: "Automação com IA", hint: "Agentes e fluxos automáticos" },
  { chave: "sistemas_erp", label: "Sistemas e ERP", hint: "Gestão da operação num sistema" },
  { chave: "ecommerce", label: "E-commerce", hint: "Loja virtual com pagamento" },
  { chave: "websites", label: "Websites", hint: "Site profissional" },
  { chave: "branding", label: "Branding", hint: "Identidade visual e marca" },
];

/** Plano de Indicações apresentado ao cliente nas duas reuniões. */
export const PLANO_INDICACOES = {
  leadsParaDesconto: 5,
  descricaoDesconto: "20% de desconto na mensalidade",
  descricaoFechada: "mensalidade seguinte abatida",
};

/** De quantos em quantos dias o cliente ativo deve passar por uma coleta de satisfação. */
export const DIAS_ENTRE_COLETAS = 90;

export type NpsCategoria = "promotor" | "neutro" | "detrator";

/** NPS: até 6 não recomendaria, 7–8 neutro, 9–10 recomendaria. */
export function npsCategoria(nota: number): NpsCategoria {
  return nota >= 9 ? "promotor" : nota >= 7 ? "neutro" : "detrator";
}

export const NPS_META: Record<NpsCategoria, { label: string; classe: string; barra: string }> = {
  detrator: {
    label: "Não recomendaria",
    classe: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    barra: "bg-red-400",
  },
  neutro: {
    label: "Neutro",
    classe: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    barra: "bg-amber-400",
  },
  promotor: {
    label: "Recomendaria",
    classe: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    barra: "bg-emerald-400",
  },
};

export function notas(p: Pesquisa) {
  return TODAS_PERGUNTAS.map((k) => p[k]).filter((n): n is number => n != null);
}

/** Média das perguntas de 1 a 5 de uma pesquisa (null se nenhuma foi respondida). */
export function mediaPesquisa(p: Pesquisa) {
  const ns = notas(p);
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
}

/** Como ler uma média de 1 a 5. */
export function tomMedia(media: number): "bom" | "medio" | "ruim" {
  return media >= 4 ? "bom" : media >= 3 ? "medio" : "ruim";
}

export function escalaDe(nota: number) {
  return ESCALA[Math.min(5, Math.max(1, Math.round(nota))) - 1];
}

export function formatarMedia(media: number) {
  return media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** NPS de um conjunto de notas: % que recomendaria − % que não recomendaria. */
export function calcularNps(notasNps: number[]) {
  const total = notasNps.length;
  const promotores = notasNps.filter((n) => n >= 9).length;
  const detratores = notasNps.filter((n) => n <= 6).length;
  const neutros = total - promotores - detratores;
  const valor = total ? Math.round(((promotores - detratores) / total) * 100) : null;
  return { valor, total, promotores, neutros, detratores };
}

/** Farol sugerido a partir do resultado da pesquisa. */
export function farolSugerido(media: number | null, nps: number | null) {
  const ruim = (media != null && media < 3) || (nps != null && nps <= 6);
  const medio = (media != null && media < 4) || (nps != null && nps <= 8);
  if (media == null && nps == null) return null;
  return ruim ? "vermelho" : medio ? "amarelo" : "verde";
}

/** Coleta pendente: projeto ativo sem nenhuma pesquisa nos últimos 90 dias. */
export function coletaPendente(ultima: Pesquisa | undefined) {
  if (!ultima) return true;
  return diasAte(ultima.data) < -DIAS_ENTRE_COLETAS;
}
