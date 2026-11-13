-- =====================================================================
-- Sucesso do Cliente (CS) dentro do CRM.
-- Três tabelas pequenas ligadas aos projetos existentes:
--   1) project_cs            farol, motivo, responsável CS e próximo contato
--   2) project_cs_registros  contatos, reuniões e pesquisas (NPS / CSAT)
--   3) project_cs_indicacoes empresas indicadas pelo cliente
-- Acesso igual ao do projeto: admin ou membro do projeto.
-- Nenhuma tabela ou dado existente é alterado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Farol e próximo contato (uma linha por projeto)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_cs (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  farol text CHECK (farol IS NULL OR farol IN ('verde','amarelo','vermelho')),
  farol_motivo text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  proximo_contato date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cs TO authenticated;
GRANT ALL ON public.project_cs TO service_role;
ALTER TABLE public.project_cs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cs_select" ON public.project_cs;
CREATE POLICY "project_cs_select" ON public.project_cs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_insert" ON public.project_cs;
CREATE POLICY "project_cs_insert" ON public.project_cs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_update" ON public.project_cs;
CREATE POLICY "project_cs_update" ON public.project_cs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_delete" ON public.project_cs;
CREATE POLICY "project_cs_delete" ON public.project_cs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_project_cs_updated_at ON public.project_cs;
CREATE TRIGGER update_project_cs_updated_at BEFORE UPDATE ON public.project_cs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 2) Linha do tempo: contatos, reuniões e pesquisas de satisfação
--    NPS vai de 0 a 10; CSAT de 1 a 5; contato e reunião não têm nota.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_cs_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('contato','reuniao','nps','csat')),
  data date NOT NULL DEFAULT current_date,
  nota integer,
  comentario text,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_cs_registros_nota_valida CHECK (
    (tipo = 'nps' AND nota BETWEEN 0 AND 10)
    OR (tipo = 'csat' AND nota BETWEEN 1 AND 5)
    OR (tipo IN ('contato','reuniao') AND nota IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_project_cs_registros_project
  ON public.project_cs_registros (project_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cs_registros TO authenticated;
GRANT ALL ON public.project_cs_registros TO service_role;
ALTER TABLE public.project_cs_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cs_registros_select" ON public.project_cs_registros;
CREATE POLICY "project_cs_registros_select" ON public.project_cs_registros FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_registros_insert" ON public.project_cs_registros;
CREATE POLICY "project_cs_registros_insert" ON public.project_cs_registros FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
    AND (autor_id = auth.uid() OR autor_id IS NULL)
  );
DROP POLICY IF EXISTS "project_cs_registros_update" ON public.project_cs_registros;
CREATE POLICY "project_cs_registros_update" ON public.project_cs_registros FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());
DROP POLICY IF EXISTS "project_cs_registros_delete" ON public.project_cs_registros;
CREATE POLICY "project_cs_registros_delete" ON public.project_cs_registros FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3) Indicações feitas pelo cliente
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_cs_indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  empresa text NOT NULL,
  contato text,
  telefone text,
  status text NOT NULL DEFAULT 'nova'
    CHECK (status IN ('nova','em_contato','proposta','fechada','perdida')),
  observacoes text,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_cs_indicacoes_project
  ON public.project_cs_indicacoes (project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cs_indicacoes TO authenticated;
GRANT ALL ON public.project_cs_indicacoes TO service_role;
ALTER TABLE public.project_cs_indicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cs_indicacoes_select" ON public.project_cs_indicacoes;
CREATE POLICY "project_cs_indicacoes_select" ON public.project_cs_indicacoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_indicacoes_insert" ON public.project_cs_indicacoes;
CREATE POLICY "project_cs_indicacoes_insert" ON public.project_cs_indicacoes FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
    AND (autor_id = auth.uid() OR autor_id IS NULL)
  );
DROP POLICY IF EXISTS "project_cs_indicacoes_update" ON public.project_cs_indicacoes;
CREATE POLICY "project_cs_indicacoes_update" ON public.project_cs_indicacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));
DROP POLICY IF EXISTS "project_cs_indicacoes_delete" ON public.project_cs_indicacoes;
CREATE POLICY "project_cs_indicacoes_delete" ON public.project_cs_indicacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());

DROP TRIGGER IF EXISTS update_project_cs_indicacoes_updated_at ON public.project_cs_indicacoes;
CREATE TRIGGER update_project_cs_indicacoes_updated_at BEFORE UPDATE ON public.project_cs_indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
