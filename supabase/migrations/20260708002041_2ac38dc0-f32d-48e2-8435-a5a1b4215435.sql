
CREATE TABLE public.sale_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  nome text NOT NULL,
  path text NOT NULL,
  size bigint,
  mime text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_attachments_sale_id ON public.sale_attachments(sale_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_attachments TO authenticated;
GRANT ALL ON public.sale_attachments TO service_role;

ALTER TABLE public.sale_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_attachments select" ON public.sale_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.has_role(auth.uid(),'admin') OR public.is_project_member(auth.uid(), s.project_id))));

CREATE POLICY "sale_attachments insert" ON public.sale_attachments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.has_role(auth.uid(),'admin') OR public.is_project_member(auth.uid(), s.project_id))));

CREATE POLICY "sale_attachments delete" ON public.sale_attachments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.has_role(auth.uid(),'admin') OR public.is_project_member(auth.uid(), s.project_id))));

CREATE POLICY "sale-attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'sale-attachments' AND EXISTS (
    SELECT 1 FROM public.sale_attachments a JOIN public.sales s ON s.id = a.sale_id
    WHERE a.path = storage.objects.name AND (public.has_role(auth.uid(),'admin') OR public.is_project_member(auth.uid(), s.project_id))
  )
);

CREATE POLICY "sale-attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sale-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "sale-attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sale-attachments' AND EXISTS (
    SELECT 1 FROM public.sale_attachments a JOIN public.sales s ON s.id = a.sale_id
    WHERE a.path = storage.objects.name AND (public.has_role(auth.uid(),'admin') OR public.is_project_member(auth.uid(), s.project_id))
  )
);
