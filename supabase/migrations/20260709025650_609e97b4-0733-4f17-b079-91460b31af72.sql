-- 1) severity in activity_logs
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warn','critical'));

CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON public.activity_logs (severity);

-- 2) Overload log_activity with severity (keep old signature for triggers)
CREATE OR REPLACE FUNCTION public.log_activity(
  _acao text,
  _entity_type text,
  _entity_id uuid,
  _entity_name text,
  _details jsonb,
  _severity text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (actor_id, acao, entity_type, entity_id, entity_name, details, severity)
  VALUES (auth.uid(), _acao, _entity_type, _entity_id, _entity_name, _details,
          COALESCE(NULLIF(_severity,''), 'info'));
END; $$;

-- 3) Admin RPCs now log with severity='critical'
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admin';
  END IF;
  SELECT nome INTO target_name FROM public.profiles WHERE id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  PERFORM public.log_activity(
    'mudou_papel','usuario',_user_id, COALESCE(target_name,'Usuário'),
    jsonb_build_object('para',_role), 'critical'
  );
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_ativo(_user_id uuid, _ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admin';
  END IF;
  IF _user_id = auth.uid() AND _ativo = false THEN
    RAISE EXCEPTION 'Você não pode desativar seu próprio usuário';
  END IF;
  SELECT nome INTO target_name FROM public.profiles WHERE id = _user_id;
  UPDATE public.profiles SET ativo = _ativo WHERE id = _user_id;
  PERFORM public.log_activity(
    CASE WHEN _ativo THEN 'ativou' ELSE 'desativou' END,
    'usuario', _user_id, COALESCE(target_name,'Usuário'),
    NULL, 'critical'
  );
END; $$;

-- 4) Delete project (admin only) — audited
CREATE OR REPLACE FUNCTION public.admin_delete_project(_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE pname text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admin pode apagar projetos';
  END IF;
  SELECT nome INTO pname FROM public.projects WHERE id = _project_id;
  IF pname IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;
  DELETE FROM public.projects WHERE id = _project_id;
  PERFORM public.log_activity('excluiu','projeto',_project_id, pname, NULL, 'critical');
END; $$;

REVOKE ALL ON FUNCTION public.admin_delete_project(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_project(uuid) TO authenticated;