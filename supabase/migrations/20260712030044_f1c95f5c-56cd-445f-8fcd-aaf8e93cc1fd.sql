
-- LEADS
CREATE TABLE public.partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  empresa TEXT,
  contato TEXT,
  origem TEXT,
  etapa TEXT NOT NULL DEFAULT 'lead' CHECK (etapa IN ('lead','contato_feito','proposta_enviada','fechado','perdido')),
  proximo_passo TEXT,
  data_lembrete DATE,
  valor_estimado NUMERIC(12,2),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_leads TO authenticated;
GRANT ALL ON public.partner_leads TO service_role;
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "socios_leads_all" ON public.partner_leads FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_partner_leads_updated BEFORE UPDATE ON public.partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DECISOES
CREATE TABLE public.partner_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contexto TEXT,
  decisao TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_decisions TO authenticated;
GRANT ALL ON public.partner_decisions TO service_role;
ALTER TABLE public.partner_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "socios_decisions_all" ON public.partner_decisions FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_partner_decisions_updated BEFORE UPDATE ON public.partner_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- METAS / OKRs
CREATE TABLE public.partner_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  periodo TEXT NOT NULL,
  meta_valor NUMERIC(12,2),
  progresso NUMERIC(6,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida','atrasada')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_goals TO authenticated;
GRANT ALL ON public.partner_goals TO service_role;
ALTER TABLE public.partner_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "socios_goals_all" ON public.partner_goals FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_partner_goals_updated BEFORE UPDATE ON public.partner_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LEMBRETES: função que dispara notificações no sino p/ ambos os admins
CREATE OR REPLACE FUNCTION public.partner_generate_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_ids uuid[];
  events_sent int := 0;
  leads_sent int := 0;
  rec record;
BEGIN
  SELECT array_agg(user_id) INTO admin_ids FROM public.user_roles WHERE role = 'admin';
  IF admin_ids IS NULL OR array_length(admin_ids,1) = 0 THEN
    RETURN jsonb_build_object('events', 0, 'leads', 0);
  END IF;

  -- Eventos que começam nas próximas 24h e ainda não notificados
  FOR rec IN
    SELECT e.id, e.titulo, e.inicio
    FROM public.partner_events e
    WHERE e.inicio >= now()
      AND e.inicio < now() + interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.tipo = 'socios_evento'
          AND n.link = '/socios?event=' || e.id::text
      )
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, link)
    SELECT uid, 'socios_evento',
           'Sócios: ' || rec.titulo || ' às ' || to_char(rec.inicio AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI'),
           '/socios?event=' || rec.id::text
    FROM unnest(admin_ids) AS uid;
    events_sent := events_sent + 1;
  END LOOP;

  -- Leads com data_lembrete hoje ou atrasada, ainda não notificados hoje
  FOR rec IN
    SELECT l.id, l.nome, l.proximo_passo, l.data_lembrete
    FROM public.partner_leads l
    WHERE l.data_lembrete IS NOT NULL
      AND l.data_lembrete <= CURRENT_DATE
      AND l.etapa NOT IN ('fechado','perdido')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.tipo = 'socios_lead'
          AND n.link = '/socios?lead=' || l.id::text
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, link)
    SELECT uid, 'socios_lead',
           'Follow-up: ' || rec.nome || COALESCE(' — ' || rec.proximo_passo, ''),
           '/socios?lead=' || rec.id::text
    FROM unnest(admin_ids) AS uid;
    leads_sent := leads_sent + 1;
  END LOOP;

  RETURN jsonb_build_object('events', events_sent, 'leads', leads_sent);
END;
$$;

-- Agendar execução horária
SELECT cron.unschedule('partner-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'partner-reminders');
SELECT cron.schedule('partner-reminders', '0 * * * *', $$SELECT public.partner_generate_reminders();$$);
