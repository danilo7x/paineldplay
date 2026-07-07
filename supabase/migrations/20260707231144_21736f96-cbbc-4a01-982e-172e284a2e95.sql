
-- =========================
-- personal_files
-- =========================
CREATE TABLE public.personal_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_files TO authenticated;
GRANT ALL ON public.personal_files TO service_role;
ALTER TABLE public.personal_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pf select own or admin" ON public.personal_files FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pf insert own" ON public.personal_files FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pf update own or admin" ON public.personal_files FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pf delete own or admin" ON public.personal_files FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_personal_files_owner ON public.personal_files(owner_id);

-- storage policies for personal-files bucket
CREATE POLICY "pf storage select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'personal-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "pf storage insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'personal-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "pf storage update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'personal-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "pf storage delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'personal-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- =========================
-- notes (personal)
-- =========================
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text,
  conteudo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes own all" ON public.notes FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_notes_user ON public.notes(user_id);

-- =========================
-- notices
-- =========================
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices select all" ON public.notices FOR SELECT TO authenticated
USING (true);
CREATE POLICY "notices admin insert" ON public.notices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notices admin update" ON public.notices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notices admin delete" ON public.notices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_notices_created_at ON public.notices(created_at DESC);

-- =========================
-- notice_reads
-- =========================
CREATE TABLE public.notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notice_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_reads TO authenticated;
GRANT ALL ON public.notice_reads TO service_role;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reads select own or admin" ON public.notice_reads FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reads insert own" ON public.notice_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reads delete own" ON public.notice_reads FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_notice_reads_notice ON public.notice_reads(notice_id);
CREATE INDEX idx_notice_reads_user ON public.notice_reads(user_id);
