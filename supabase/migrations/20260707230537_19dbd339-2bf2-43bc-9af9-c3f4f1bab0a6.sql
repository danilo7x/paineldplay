
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'outros',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses admin select" ON public.expenses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "expenses admin insert" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "expenses admin update" ON public.expenses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "expenses admin delete" ON public.expenses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_expenses_data ON public.expenses(data);
CREATE INDEX IF NOT EXISTS idx_expenses_categoria ON public.expenses(categoria);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON public.expenses(project_id);
