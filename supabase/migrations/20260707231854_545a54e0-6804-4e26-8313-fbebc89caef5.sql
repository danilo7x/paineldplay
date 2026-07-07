-- Activity logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin ve tudo activity" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff ve proprias activity" ON public.activity_logs
  FOR SELECT TO authenticated USING (actor_id = auth.uid());
CREATE POLICY "insert via trigger" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_actor ON public.activity_logs (actor_id);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs (entity_type);

-- Log helper
CREATE OR REPLACE FUNCTION public.log_activity(_acao text, _entity_type text, _entity_id uuid, _entity_name text, _details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (actor_id, acao, entity_type, entity_id, entity_name, details)
  VALUES (auth.uid(), _acao, _entity_type, _entity_id, _entity_name, _details);
END; $$;

-- Triggers per table
CREATE OR REPLACE FUNCTION public.trg_log_projects()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('criou','projeto',NEW.id,NEW.nome,NULL);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('mudou_status','projeto',NEW.id,NEW.nome,jsonb_build_object('de',OLD.status,'para',NEW.status));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER log_projects AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_projects();

CREATE OR REPLACE FUNCTION public.trg_log_sales()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname text;
BEGIN
  SELECT nome INTO pname FROM public.projects WHERE id = NEW.project_id;
  PERFORM public.log_activity('criou','venda',NEW.id,COALESCE(pname,'Venda'),jsonb_build_object('valor',NEW.valor));
  RETURN NEW;
END; $$;
CREATE TRIGGER log_sales AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_sales();

CREATE OR REPLACE FUNCTION public.trg_log_expenses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_activity('criou','despesa',NEW.id,NEW.descricao,jsonb_build_object('valor',NEW.valor));
  RETURN NEW;
END; $$;
CREATE TRIGGER log_expenses AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_expenses();

CREATE OR REPLACE FUNCTION public.trg_log_notices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_activity('criou','aviso',NEW.id,NEW.titulo,NULL);
  RETURN NEW;
END; $$;
CREATE TRIGGER log_notices AFTER INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_notices();

CREATE OR REPLACE FUNCTION public.trg_log_project_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname text; uname text;
BEGIN
  SELECT nome INTO pname FROM public.projects WHERE id = NEW.project_id;
  SELECT nome INTO uname FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.log_activity('adicionou_membro','membro',NEW.project_id,COALESCE(pname,'Projeto'),jsonb_build_object('membro',uname));
  RETURN NEW;
END; $$;
CREATE TRIGGER log_project_members AFTER INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_project_members();

CREATE OR REPLACE FUNCTION public.trg_log_project_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname text;
BEGIN
  SELECT nome INTO pname FROM public.projects WHERE id = NEW.project_id;
  PERFORM public.log_activity('criou','etapa',NEW.id,COALESCE(NEW.titulo, pname),NULL);
  RETURN NEW;
END; $$;
CREATE TRIGGER log_project_steps AFTER INSERT ON public.project_steps
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_project_steps();

-- User sessions
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  device_name text,
  device_type text DEFAULT 'unknown',
  browser text,
  os text,
  ip_address text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user own sessions select" ON public.user_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user own sessions insert" ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user own sessions update" ON public.user_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user own sessions delete" ON public.user_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_user_sessions_user ON public.user_sessions (user_id, last_active_at DESC);