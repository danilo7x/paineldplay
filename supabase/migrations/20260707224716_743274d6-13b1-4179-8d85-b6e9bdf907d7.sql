
-- Enums
CREATE TYPE public.project_status AS ENUM ('em_desenvolvimento','em_manutencao','concluido','pausado');
CREATE TYPE public.project_step_status AS ENUM ('pendente','em_andamento','concluido');

-- =====================================================
-- projects
-- =====================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cliente text,
  descricao text,
  status public.project_status NOT NULL DEFAULT 'em_desenvolvimento',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- project_members
-- =====================================================
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX ON public.project_members (user_id);
CREATE INDEX ON public.project_members (project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- =====================================================
-- project_steps
-- =====================================================
CREATE TABLE public.project_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  status public.project_step_status NOT NULL DEFAULT 'pendente',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.project_steps (project_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_steps TO authenticated;
GRANT ALL ON public.project_steps TO service_role;

ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- project_notes
-- =====================================================
CREATE TABLE public.project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.project_notes (project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_notes TO authenticated;
GRANT ALL ON public.project_notes TO service_role;

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- project_credentials
-- =====================================================
CREATE TABLE public.project_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nome_acesso text NOT NULL,
  login text,
  senha text,
  url text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.project_credentials (project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_credentials TO authenticated;
GRANT ALL ON public.project_credentials TO service_role;

ALTER TABLE public.project_credentials ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS: projects
-- =====================================================
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), id));

CREATE POLICY "projects_insert_admin" ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "projects_update_admin" ON public.projects FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "projects_delete_admin" ON public.projects FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RLS: project_members
-- =====================================================
CREATE POLICY "project_members_select" ON public.project_members FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
  OR public.is_project_member(auth.uid(), project_id)
);

CREATE POLICY "project_members_admin_all" ON public.project_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RLS: project_steps
-- =====================================================
CREATE POLICY "project_steps_select" ON public.project_steps FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "project_steps_insert" ON public.project_steps FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
  AND (autor_id = auth.uid() OR autor_id IS NULL)
);

CREATE POLICY "project_steps_update" ON public.project_steps FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "project_steps_delete" ON public.project_steps FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());

-- =====================================================
-- RLS: project_notes
-- =====================================================
CREATE POLICY "project_notes_select" ON public.project_notes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "project_notes_insert" ON public.project_notes FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id))
  AND (autor_id = auth.uid() OR autor_id IS NULL)
);

CREATE POLICY "project_notes_update" ON public.project_notes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());

CREATE POLICY "project_notes_delete" ON public.project_notes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR autor_id = auth.uid());

-- =====================================================
-- RLS: project_credentials
-- =====================================================
CREATE POLICY "project_credentials_select" ON public.project_credentials FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "project_credentials_admin_all" ON public.project_credentials FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- Triggers updated_at
-- =====================================================
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_project_steps_updated_at
BEFORE UPDATE ON public.project_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
