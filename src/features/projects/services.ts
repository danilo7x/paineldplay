/** Serviços que a DPlay entrega (base do ticket médio por serviço). */
export type ProjectService =
  | "website"
  | "certificado"
  | "automacao_inteligente"
  | "software"
  | "erp"
  | "ecommerce"
  | "branding";

export const PROJECT_SERVICES: { value: ProjectService; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "certificado", label: "Certificado" },
  { value: "automacao_inteligente", label: "Automação Inteligente" },
  { value: "software", label: "Software" },
  { value: "erp", label: "ERP" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "branding", label: "Branding" },
];

export function serviceLabel(v: string | null | undefined) {
  return PROJECT_SERVICES.find((s) => s.value === v)?.label ?? null;
}
