
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  link text,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE lida_em IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications delete own" ON public.notifications;
CREATE POLICY "notifications delete own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Inserts são feitos por triggers SECURITY DEFINER; sem policy INSERT para authenticated.

-- Trigger: novo aviso → notifica todos os ativos
CREATE OR REPLACE FUNCTION public.trg_notify_new_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, tipo, titulo, link)
  SELECT p.id,
         CASE WHEN NEW.critico THEN 'aviso_critico' ELSE 'aviso' END,
         CASE WHEN NEW.critico THEN 'Aviso crítico: ' ELSE 'Novo aviso: ' END || NEW.titulo,
         '/avisos'
  FROM public.profiles p
  WHERE p.ativo = true;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_new_notice ON public.notices;
CREATE TRIGGER notify_new_notice
  AFTER INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_notice();

-- Trigger: novo login/dispositivo → notifica o próprio usuário
CREATE OR REPLACE FUNCTION public.trg_notify_new_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, tipo, titulo, link)
  VALUES (
    NEW.user_id,
    'novo_login',
    'Novo acesso' ||
      CASE
        WHEN NEW.device_name IS NOT NULL THEN ' em ' || NEW.device_name
        WHEN NEW.browser IS NOT NULL THEN ' via ' || NEW.browser
        ELSE ''
      END,
    '/perfil'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_new_session ON public.user_sessions;
CREATE TRIGGER notify_new_session
  AFTER INSERT ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_session();

-- Trigger: novo membro em projeto → notifica o adicionado
CREATE OR REPLACE FUNCTION public.trg_notify_project_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pname text;
BEGIN
  SELECT nome INTO pname FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications (user_id, tipo, titulo, link)
  VALUES (
    NEW.user_id,
    'projeto_membro',
    'Você foi adicionado ao projeto ' || COALESCE(pname, 'Projeto'),
    '/projetos/' || NEW.project_id::text
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_project_member ON public.project_members;
CREATE TRIGGER notify_project_member
  AFTER INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_member();

-- Trigger: nova venda → notifica membros do projeto (exceto quem criou)
CREATE OR REPLACE FUNCTION public.trg_notify_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pname text;
BEGIN
  SELECT nome INTO pname FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications (user_id, tipo, titulo, link)
  SELECT pm.user_id,
         'venda',
         'Nova venda em ' || COALESCE(pname, 'projeto') || ': ' || NEW.cliente_nome,
         '/projetos/' || NEW.project_id::text
  FROM public.project_members pm
  WHERE pm.project_id = NEW.project_id
    AND pm.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_sale ON public.sales;
CREATE TRIGGER notify_sale
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_sale();
