
-- ============ partner_events ============
CREATE TABLE public.partner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  inicio timestamptz NOT NULL,
  fim timestamptz,
  local text,
  link text,
  tipo text NOT NULL DEFAULT 'reuniao' CHECK (tipo IN ('reuniao','compromisso','lembrete')),
  recorrencia text NOT NULL DEFAULT 'nenhuma' CHECK (recorrencia IN ('nenhuma','semanal','mensal')),
  pauta text,
  ata text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_events TO authenticated;
GRANT ALL ON public.partner_events TO service_role;
ALTER TABLE public.partner_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partner_events"
  ON public.partner_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER partner_events_updated
  BEFORE UPDATE ON public.partner_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX partner_events_inicio_idx ON public.partner_events (inicio);

-- ============ partner_tasks ============
CREATE TABLE public.partner_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer','fazendo','feito')),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_ambos boolean NOT NULL DEFAULT false,
  due_date date,
  origem_event_id uuid REFERENCES public.partner_events(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_tasks TO authenticated;
GRANT ALL ON public.partner_tasks TO service_role;
ALTER TABLE public.partner_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partner_tasks"
  ON public.partner_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER partner_tasks_updated
  BEFORE UPDATE ON public.partner_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ partner_notes ============
CREATE TABLE public.partner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'nota' CHECK (tipo IN ('nota','ideia')),
  titulo text,
  conteudo text NOT NULL DEFAULT '',
  status text CHECK (status IN ('nova','avaliando','aprovada','descartada')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_notes TO authenticated;
GRANT ALL ON public.partner_notes TO service_role;
ALTER TABLE public.partner_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partner_notes"
  ON public.partner_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER partner_notes_updated
  BEFORE UPDATE ON public.partner_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
