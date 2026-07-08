
CREATE TABLE public.rani_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rani_threads_user ON public.rani_threads(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rani_threads TO authenticated;
GRANT ALL ON public.rani_threads TO service_role;

ALTER TABLE public.rani_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rani_threads select own" ON public.rani_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rani_threads insert own" ON public.rani_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rani_threads update own" ON public.rani_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rani_threads delete own" ON public.rani_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_rani_threads_updated_at BEFORE UPDATE ON public.rani_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rani_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.rani_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rani_messages_thread ON public.rani_messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rani_messages TO authenticated;
GRANT ALL ON public.rani_messages TO service_role;

ALTER TABLE public.rani_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rani_messages select own" ON public.rani_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rani_messages insert own" ON public.rani_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.rani_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "rani_messages delete own" ON public.rani_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage policies (bucket 'rani-attachments'; paths namespaced as <user_id>/<thread_id>/<file>)
CREATE POLICY "rani-attachments read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rani-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "rani-attachments insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rani-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "rani-attachments delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rani-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
