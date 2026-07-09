
-- Categorias de despesa
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#057EF3',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_select_auth"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "expense_categories_insert_finance"
  ON public.expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "expense_categories_update_finance"
  ON public.expense_categories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "expense_categories_delete_finance"
  ON public.expense_categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial (mesmos slugs em uso hoje)
INSERT INTO public.expense_categories (slug, nome, cor) VALUES
  ('ferramentas',   'Ferramentas',    '#057EF3'),
  ('marketing',     'Marketing',      '#31B7FF'),
  ('impostos',      'Impostos',       '#8B5CF6'),
  ('salarios',      'Salários',       '#F59E0B'),
  ('infra',         'Infraestrutura', '#10B981'),
  ('outros',        'Outros',         '#F43F5E')
ON CONFLICT (slug) DO NOTHING;

-- Metas mensais
CREATE TABLE public.financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL UNIQUE,
  receita_meta numeric NOT NULL DEFAULT 0,
  lucro_meta numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goals TO authenticated;
GRANT ALL ON public.financial_goals TO service_role;

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_goals_select_finance"
  ON public.financial_goals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "financial_goals_insert_finance"
  ON public.financial_goals FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "financial_goals_update_finance"
  ON public.financial_goals FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "financial_goals_delete_finance"
  ON public.financial_goals FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE TRIGGER update_financial_goals_updated_at
  BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
