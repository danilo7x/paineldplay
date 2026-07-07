
-- Sales status enum
DO $$ BEGIN
  CREATE TYPE public.sale_status AS ENUM ('pendente','pago','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cliente_nome text NOT NULL,
  cliente_email text,
  cliente_contato text,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status public.sale_status NOT NULL DEFAULT 'pendente',
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales select" ON public.sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_project_member(auth.uid(), project_id)
);

CREATE POLICY "sales insert" ON public.sales FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_project_member(auth.uid(), project_id)
);

CREATE POLICY "sales update" ON public.sales FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_project_member(auth.uid(), project_id)
) WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_project_member(auth.uid(), project_id)
);

CREATE POLICY "sales delete" ON public.sales FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_project_member(auth.uid(), project_id)
);

CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes to accelerate RLS + common queries
CREATE INDEX IF NOT EXISTS idx_sales_project_id ON public.sales(project_id);
CREATE INDEX IF NOT EXISTS idx_sales_data ON public.sales(data);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_project_id ON public.project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON public.project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_credentials_project_id ON public.project_credentials(project_id);
