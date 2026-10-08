-- =====================================================================
-- Banco de Leads + indicadores comerciais
--
--   * lead_bank_groups: listas do Banco de Leads (ex.: "Indicações 26.2");
--   * lead_bank: leads registrados em massa (nome, empresa, quem entrou em
--     contato, status, data da reunião). É um quadro compartilhado entre
--     quem tem acesso comercial;
--   * automação: status "Reunião marcada" com data cria (ou reagenda) o
--     lead no Kanban, na etapa "Reunião de diagnóstico", com a reunião
--     prevista no histórico — igual a marcar a reunião pelo próprio Kanban;
--   * lead_bank_stats: números agregados para o Analytics;
--   * projects.servico: serviço do projeto (ticket médio por serviço).
-- Nenhum dado existente é alterado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Listas (grupos) do Banco de Leads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_bank_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  cor text NOT NULL DEFAULT '#057ef3',
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_bank_groups TO authenticated;
GRANT ALL ON public.lead_bank_groups TO service_role;
ALTER TABLE public.lead_bank_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_bank_groups_select" ON public.lead_bank_groups;
DROP POLICY IF EXISTS "lead_bank_groups_insert" ON public.lead_bank_groups;
DROP POLICY IF EXISTS "lead_bank_groups_update" ON public.lead_bank_groups;
DROP POLICY IF EXISTS "lead_bank_groups_delete" ON public.lead_bank_groups;
CREATE POLICY "lead_bank_groups_select" ON public.lead_bank_groups
  FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));
CREATE POLICY "lead_bank_groups_insert" ON public.lead_bank_groups
  FOR INSERT TO authenticated WITH CHECK (public.has_commercial_access(auth.uid()));
CREATE POLICY "lead_bank_groups_update" ON public.lead_bank_groups
  FOR UPDATE TO authenticated
  USING (public.has_commercial_access(auth.uid()))
  WITH CHECK (public.has_commercial_access(auth.uid()));
-- Apagar uma lista não apaga os leads: eles ficam em "Sem lista".
CREATE POLICY "lead_bank_groups_delete" ON public.lead_bank_groups
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_lead_bank_groups_updated ON public.lead_bank_groups;
CREATE TRIGGER trg_lead_bank_groups_updated BEFORE UPDATE ON public.lead_bank_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 2) Leads do banco
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES public.lead_bank_groups(id) ON DELETE SET NULL,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  empresa text,
  telefone text,
  -- Quem entrou em contato (usuário do CRM).
  contato_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'novo_lead' CHECK (status IS NULL OR status IN (
    'novo_lead','sem_interesse','desqualificado','redirecionou','numero_errado',
    'sem_budget','cliente_atual','repetido','nao_atendeu','sem_demanda',
    'timing_errado','numero_comercial','reuniao_marcada','sem_empresa','em_fluxo',
    'retornar','parceria','numero_protegido','fluxo_finalizado','primeiro_contato'
  )),
  -- Data e hora da reunião marcada.
  reuniao_em timestamptz,
  -- Quando o status passou para "Reunião marcada" (preenchido pelo banco).
  reuniao_marcada_em timestamptz,
  -- Lead criado no Kanban pela automação (preenchido pelo banco).
  lead_id uuid REFERENCES public.partner_leads(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_bank_grupo ON public.lead_bank(grupo_id);
CREATE INDEX IF NOT EXISTS idx_lead_bank_status ON public.lead_bank(status);
CREATE INDEX IF NOT EXISTS idx_lead_bank_contato_por ON public.lead_bank(contato_por);
CREATE INDEX IF NOT EXISTS idx_lead_bank_created ON public.lead_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_bank_lead ON public.lead_bank(lead_id) WHERE lead_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_bank TO authenticated;
GRANT ALL ON public.lead_bank TO service_role;
ALTER TABLE public.lead_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_bank_select" ON public.lead_bank;
DROP POLICY IF EXISTS "lead_bank_insert" ON public.lead_bank;
DROP POLICY IF EXISTS "lead_bank_update" ON public.lead_bank;
DROP POLICY IF EXISTS "lead_bank_delete" ON public.lead_bank;
-- Quadro compartilhado: todos com acesso comercial veem e trabalham a base,
-- para ninguém ligar duas vezes para o mesmo contato.
CREATE POLICY "lead_bank_select" ON public.lead_bank
  FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));
CREATE POLICY "lead_bank_insert" ON public.lead_bank
  FOR INSERT TO authenticated
  WITH CHECK (public.has_commercial_access(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "lead_bank_update" ON public.lead_bank
  FOR UPDATE TO authenticated
  USING (public.has_commercial_access(auth.uid()))
  WITH CHECK (public.has_commercial_access(auth.uid()));
CREATE POLICY "lead_bank_delete" ON public.lead_bank
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (created_by = auth.uid() AND public.has_commercial_access(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 3) Regras e automação (antes de gravar)
--
-- SECURITY DEFINER porque cria/atualiza o lead no Kanban mesmo quando ele
-- fica com outra pessoa (quem entrou em contato). As permissões continuam
-- valendo: o RLS de lead_bank filtra o que cada um grava, e as regras
-- abaixo impedem que um colaborador atribua contatos a terceiros ou aponte
-- o registro para um lead do Kanban que não é dele.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_bank_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean := uid IS NOT NULL AND public.has_role(uid, 'admin');
  status_mudou boolean;
  reuniao_mudou boolean;
  dono uuid;
  lista text;
  quando text;
  k_etapa text;
  reagendar boolean;
BEGIN
  NEW.updated_at := now();
  IF uid IS NOT NULL THEN
    NEW.updated_by := uid;
    -- O vínculo com o Kanban é criado só pela automação. Limpar é permitido
    -- (é o que o ON DELETE SET NULL faz quando o lead do Kanban é apagado).
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := uid;
      NEW.lead_id := NULL;
    ELSE
      IF NEW.lead_id IS NOT NULL AND NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
        NEW.lead_id := OLD.lead_id;
      END IF;
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;

  -- Colaborador só registra a si mesmo como quem entrou em contato e não
  -- tira o contato de outra pessoa (admin atribui livremente).
  IF uid IS NOT NULL AND NOT is_admin THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.contato_por IS NOT NULL AND NEW.contato_por <> uid THEN
        RAISE EXCEPTION 'Você só pode registrar a si mesmo como quem entrou em contato';
      END IF;
    ELSIF NEW.contato_por IS DISTINCT FROM OLD.contato_por THEN
      IF (OLD.contato_por IS NOT NULL AND OLD.contato_por <> uid)
         OR (NEW.contato_por IS NOT NULL AND NEW.contato_por <> uid) THEN
        RAISE EXCEPTION 'Este contato está com outra pessoa; peça a um admin para transferir';
      END IF;
    END IF;
  END IF;

  status_mudou := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
  IF NEW.status = 'reuniao_marcada' AND status_mudou THEN
    NEW.reuniao_marcada_em := now();
  END IF;

  reuniao_mudou := NEW.status = 'reuniao_marcada'
    AND NEW.reuniao_em IS NOT NULL
    AND (status_mudou OR NEW.reuniao_em IS DISTINCT FROM OLD.reuniao_em);
  IF NOT reuniao_mudou THEN
    RETURN NEW;
  END IF;

  -- -------- Automação: reunião marcada -> Kanban --------
  dono := COALESCE(NEW.contato_por, uid, NEW.created_by);
  IF dono IS NULL THEN
    RETURN NEW;
  END IF;
  quando := 'Para ' || to_char(NEW.reuniao_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

  IF NEW.lead_id IS NULL THEN
    SELECT g.nome INTO lista FROM public.lead_bank_groups g WHERE g.id = NEW.grupo_id;

    INSERT INTO public.partner_leads (
      nome, empresa, telefone, origem, observacoes, etapa, subetapa,
      responsavel_id, data_primeiro_contato,
      reuniao_em, reuniao_status,
      proximo_passo, data_lembrete, proxima_acao_responsavel_id,
      created_by
    ) VALUES (
      NEW.nome, NEW.empresa, NEW.telefone,
      'Banco de Leads' || COALESCE(' · ' || lista, ''),
      NEW.observacoes, 'reuniao', 'agendada',
      dono, now(),
      NEW.reuniao_em, 'agendada',
      'Realizar a reunião de diagnóstico',
      (NEW.reuniao_em AT TIME ZONE 'America/Sao_Paulo')::date, dono,
      COALESCE(uid, dono)
    )
    RETURNING id INTO NEW.lead_id;

    INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, observacoes, realizado_em, responsavel_id)
    VALUES (NEW.lead_id, 'sistema', 'realizada', 'Lead enviado pelo Banco de Leads',
            CASE WHEN lista IS NOT NULL THEN 'Lista: ' || lista END, now(), COALESCE(uid, dono));
    reagendar := false;
  ELSE
    SELECT l.etapa INTO k_etapa FROM public.partner_leads l WHERE l.id = NEW.lead_id;
    -- Só mexe no Kanban se o lead ainda não passou da reunião (ou foi
    -- encerrado sem venda e voltou a conversar).
    IF k_etapa IS NULL
       OR k_etapa NOT IN ('novo','primeiro_contato','cadencia','reuniao','perdido','sem_resposta') THEN
      RETURN NEW;
    END IF;
    reagendar := k_etapa = 'reuniao';

    -- Como no Kanban: a nova reunião substitui o que estava previsto.
    UPDATE public.lead_activities
      SET status = 'cancelada',
          observacoes = COALESCE(observacoes || E'\n', '') || 'Cancelada automaticamente: reunião marcada pelo Banco de Leads.'
      WHERE lead_id = NEW.lead_id AND status = 'prevista';

    UPDATE public.partner_leads SET
      etapa = 'reuniao',
      subetapa = CASE WHEN reagendar THEN 'reagendada' ELSE 'agendada' END,
      reuniao_em = NEW.reuniao_em,
      reuniao_status = CASE WHEN reagendar THEN 'reagendada' ELSE 'agendada' END,
      cadencia_status = CASE WHEN cadencia_status = 'ativa' THEN 'respondida' ELSE cadencia_status END,
      proximo_passo = 'Realizar a reunião de diagnóstico',
      data_lembrete = (NEW.reuniao_em AT TIME ZONE 'America/Sao_Paulo')::date,
      proxima_acao_responsavel_id = COALESCE(responsavel_id, dono)
    WHERE id = NEW.lead_id;
  END IF;

  -- Mesmo histórico de quando a reunião é marcada pelo Kanban.
  INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, resultado, observacoes, realizado_em, responsavel_id)
  VALUES (
    NEW.lead_id, 'reuniao', 'realizada',
    CASE WHEN reagendar THEN 'Reunião de diagnóstico reagendada' ELSE 'Reunião de diagnóstico marcada' END,
    quando, 'Pelo Banco de Leads', now(), COALESCE(uid, dono)
  );
  INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, chave, previsto_para, responsavel_id)
  VALUES (NEW.lead_id, 'reuniao', 'prevista', 'Reunião de diagnóstico', 'reuniao_diagnostico',
          NEW.reuniao_em, dono);

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lead_bank_before_write() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_lead_bank_before_write ON public.lead_bank;
CREATE TRIGGER trg_lead_bank_before_write
  BEFORE INSERT OR UPDATE ON public.lead_bank
  FOR EACH ROW EXECUTE FUNCTION public.lead_bank_before_write();

-- ---------------------------------------------------------------------
-- 4) Números do banco para o Analytics (respeita o RLS de quem chama)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_bank_stats(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.lead_bank),
    'novos_periodo', (
      SELECT count(*) FROM public.lead_bank WHERE created_at >= _from AND created_at < _to
    ),
    'reunioes_periodo', (
      SELECT count(*) FROM public.lead_bank
      WHERE reuniao_marcada_em >= _from AND reuniao_marcada_em < _to
    ),
    'por_status', COALESCE((
      SELECT jsonb_object_agg(s.status, s.n)
      FROM (
        SELECT COALESCE(status, 'sem_status') AS status, count(*) AS n
        FROM public.lead_bank GROUP BY 1
      ) s
    ), '{}'::jsonb),
    -- Semanas começando na segunda-feira, no fuso de São Paulo.
    'semanal', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('semana', w.semana, 'total', w.n) ORDER BY w.semana)
      FROM (
        SELECT to_char(date_trunc('week', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS semana,
               count(*) AS n
        FROM public.lead_bank
        WHERE created_at >= _from AND created_at < _to
        GROUP BY 1
      ) w
    ), '[]'::jsonb)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.lead_bank_stats(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_bank_stats(timestamptz, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------
-- 5) Serviço do projeto (ticket médio por serviço)
-- ---------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS servico text CHECK (servico IS NULL OR servico IN (
    'website','certificado','automacao_inteligente','software','erp','ecommerce','branding'
  ));
CREATE INDEX IF NOT EXISTS idx_projects_servico ON public.projects(servico) WHERE servico IS NOT NULL;

NOTIFY pgrst, 'reload schema';
