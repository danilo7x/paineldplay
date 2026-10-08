-- =====================================================================
-- Serviço do projeto (base do ticket médio por serviço no Analytics).
-- Coluna opcional: projetos existentes ficam sem serviço até alguém
-- escolher. Nenhum dado existente é alterado.
-- =====================================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS servico text CHECK (servico IS NULL OR servico IN (
    'website','certificado','automacao_inteligente','software','erp','ecommerce','branding'
  ));
CREATE INDEX IF NOT EXISTS idx_projects_servico ON public.projects(servico) WHERE servico IS NOT NULL;

NOTIFY pgrst, 'reload schema';
