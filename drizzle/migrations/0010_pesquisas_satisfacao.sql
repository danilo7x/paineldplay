-- =====================================================================
-- Pesquisas de satisfação do Sucesso do Cliente.
-- Segue os dois roteiros de reunião da DPlay:
--   coleta = Reunião de Coleta de Satisfação Geral (durante o projeto)
--   raf    = Reunião de Alinhamento Final (fim do projeto)
-- Notas de 1 a 5 (muito insatisfeito → muito satisfeito) por pergunta,
-- NPS de 0 a 10, feedback aberto e, no RAF, meses de acompanhamento e
-- interesse em outras soluções da DPlay.
-- Só cria uma tabela nova. Nenhuma tabela ou dado existente é alterado.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_cs_pesquisas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('coleta','raf')),
  data date NOT NULL DEFAULT current_date,
  -- Perguntas de 1 a 5 (cada roteiro usa um subconjunto)
  comunicacao smallint CHECK (comunicacao BETWEEN 1 AND 5),
  andamento smallint CHECK (andamento BETWEEN 1 AND 5),
  qualidade_servico smallint CHECK (qualidade_servico BETWEEN 1 AND 5),
  qualidade_entregaveis smallint CHECK (qualidade_entregaveis BETWEEN 1 AND 5),
  facilidade_uso smallint CHECK (facilidade_uso BETWEEN 1 AND 5),
  impacto smallint CHECK (impacto BETWEEN 1 AND 5),
  satisfacao_geral smallint CHECK (satisfacao_geral BETWEEN 1 AND 5),
  -- Recomendação (NPS)
  nps smallint CHECK (nps BETWEEN 0 AND 10),
  -- Feedback aberto
  funcionou_bem text,
  melhorar text,
  sugestoes text,
  -- Só no alinhamento final
  meses_acompanhamento smallint CHECK (meses_acompanhamento BETWEEN 0 AND 36),
  interesses text[] NOT NULL DEFAULT '{}'
    CHECK (interesses <@ ARRAY['automacao_ia','sistemas_erp','ecommerce','websites','branding']::text[]),
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_cs_pesquisas_project
  ON public.project_cs_pesquisas (project_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cs_pesquisas TO authenticated;
GRANT ALL ON public.project_cs_pesquisas TO service_role;
ALTER TABLE public.project_cs_pesquisas ENABLE ROW LEVEL SECURITY;

-- Mesmo acesso do restante do Sucesso do Cliente: admin ou membro do projeto.
DROP POLICY IF EXISTS "project_cs_pesquisas_select" ON public.project_cs_pesquisas;
CREATE POLICY "project_cs_pesquisas_select" ON public.project_cs_pesquisas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_pesquisas_insert" ON public.project_cs_pesquisas;
CREATE POLICY "project_cs_pesquisas_insert" ON public.project_cs_pesquisas FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
    AND (autor_id = auth.uid() OR autor_id IS NULL)
  );
DROP POLICY IF EXISTS "project_cs_pesquisas_update" ON public.project_cs_pesquisas;
CREATE POLICY "project_cs_pesquisas_update" ON public.project_cs_pesquisas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());
DROP POLICY IF EXISTS "project_cs_pesquisas_delete" ON public.project_cs_pesquisas;
CREATE POLICY "project_cs_pesquisas_delete" ON public.project_cs_pesquisas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());

NOTIFY pgrst, 'reload schema';
