
-- expenses: allow contador (in addition to admin) for all operations
DROP POLICY IF EXISTS "expenses admin select" ON public.expenses;
DROP POLICY IF EXISTS "expenses admin insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses admin update" ON public.expenses;
DROP POLICY IF EXISTS "expenses admin delete" ON public.expenses;

CREATE POLICY "expenses finance select" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "expenses finance insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "expenses finance update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

CREATE POLICY "expenses finance delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'contador'));

-- sales: extend SELECT to contador; write policies unchanged
DROP POLICY IF EXISTS "sales select" ON public.sales;

CREATE POLICY "sales select" ON public.sales
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'contador')
    OR public.is_project_member(auth.uid(), project_id)
  );
