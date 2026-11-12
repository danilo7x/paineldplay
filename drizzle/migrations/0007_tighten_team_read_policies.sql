CREATE OR REPLACE FUNCTION public.is_active_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND COALESCE(p.ativo, true));
$$;

DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
CREATE POLICY "Authenticated read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "notice_attachments select all" ON public.notice_attachments;
CREATE POLICY "notice_attachments select all" ON public.notice_attachments FOR SELECT TO authenticated
  USING (public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "expense_categories_select_auth" ON public.expense_categories;
CREATE POLICY "expense_categories_select_auth" ON public.expense_categories FOR SELECT TO authenticated
  USING (public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "notices select all" ON public.notices;
CREATE POLICY "notices select all" ON public.notices FOR SELECT TO authenticated
  USING (public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "notice-attachments read authenticated" ON storage.objects;
CREATE POLICY "notice-attachments read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notice-attachments' AND public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "Avatars read auth" ON storage.objects;
CREATE POLICY "Avatars read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.is_active_member(auth.uid()));