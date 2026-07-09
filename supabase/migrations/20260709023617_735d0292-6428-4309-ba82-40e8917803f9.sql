
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS critico boolean NOT NULL DEFAULT false;

ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_prioridade_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_prioridade_check
  CHECK (prioridade IN ('info','alerta','urgente'));

CREATE TABLE IF NOT EXISTS public.notice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notice_attachments_notice ON public.notice_attachments(notice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_attachments TO authenticated;
GRANT ALL ON public.notice_attachments TO service_role;

ALTER TABLE public.notice_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notice_attachments select all" ON public.notice_attachments;
CREATE POLICY "notice_attachments select all" ON public.notice_attachments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notice_attachments admin insert" ON public.notice_attachments;
CREATE POLICY "notice_attachments admin insert" ON public.notice_attachments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notice_attachments admin delete" ON public.notice_attachments;
CREATE POLICY "notice_attachments admin delete" ON public.notice_attachments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage policies for notice-attachments bucket
DROP POLICY IF EXISTS "notice-attachments read authenticated" ON storage.objects;
CREATE POLICY "notice-attachments read authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notice-attachments');

DROP POLICY IF EXISTS "notice-attachments admin insert" ON storage.objects;
CREATE POLICY "notice-attachments admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notice-attachments' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notice-attachments admin delete" ON storage.objects;
CREATE POLICY "notice-attachments admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'notice-attachments' AND public.has_role(auth.uid(), 'admin'));
