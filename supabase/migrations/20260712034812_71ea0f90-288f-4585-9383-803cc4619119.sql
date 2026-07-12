
-- 1) Endurece INSERT em sale-attachments: só admin ou membro do projeto da venda
DROP POLICY IF EXISTS "sale-attachments insert" ON storage.objects;
CREATE POLICY "sale-attachments insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sale-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE (storage.foldername(name))[1] = s.id::text
        AND public.is_project_member(auth.uid(), s.project_id)
    )
  )
);

-- 2) Remove INSERT aberto em activity_logs. Triggers usam log_activity() SECURITY DEFINER,
--    que roda como owner e ignora RLS, então continuam funcionando.
DROP POLICY IF EXISTS "insert via trigger" ON public.activity_logs;
