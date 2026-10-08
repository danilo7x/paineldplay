-- =====================================================================
-- Acompanhamento de Leads (processo comercial TO BE)
--
-- Migração incremental sobre public.partner_leads:
--   * amplia a tabela com os campos do processo TO BE;
--   * converte as etapas antigas (lead, contato_feito, proposta_enviada,
--     fechado, perdido) para as novas, guardando o valor original em
--     etapa_legada;
--   * cria o histórico (lead_activities), os modelos de WhatsApp
--     (lead_message_templates) e a liberação de acesso comercial
--     (commercial_access);
--   * troca a política "somente admin" por: admin vê tudo, usuário com
--     acesso comercial vê apenas os leads atribuídos a ele.
-- Nenhum registro é apagado e nenhum valor existente é sobrescrito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Acesso comercial (quem, além dos admins, opera leads)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commercial_access TO authenticated;
GRANT ALL ON public.commercial_access TO service_role;
ALTER TABLE public.commercial_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_access_select" ON public.commercial_access;
CREATE POLICY "commercial_access_select" ON public.commercial_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Escrita apenas via admin_set_commercial_access (SECURITY DEFINER).

-- Admin sempre tem acesso; os demais precisam estar liberados e ativos.
CREATE OR REPLACE FUNCTION public.has_commercial_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.commercial_access ca
      JOIN public.profiles p ON p.id = ca.user_id
      WHERE ca.user_id = _user_id
        AND COALESCE(p.ativo, true)
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_commercial_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_commercial_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_commercial_access(_user_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admin';
  END IF;
  IF _enabled THEN
    INSERT INTO public.commercial_access (user_id, granted_by)
    VALUES (_user_id, auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.commercial_access WHERE user_id = _user_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_commercial_access(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_commercial_access(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Novos campos em partner_leads
-- ---------------------------------------------------------------------
ALTER TABLE public.partner_leads
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS canal_origem text,
  ADD COLUMN IF NOT EXISTS necessidade_inicial text,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_primeiro_contato timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_primeira_ligacao text,
  ADD COLUMN IF NOT EXISTS subetapa text,
  ADD COLUMN IF NOT EXISTS proxima_acao_responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cadencia_status text,
  ADD COLUMN IF NOT EXISTS cadencia_ciclo integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nao_contatar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reuniao_em timestamptz,
  ADD COLUMN IF NOT EXISTS reuniao_status text,
  ADD COLUMN IF NOT EXISTS reuniao_local text,
  ADD COLUMN IF NOT EXISTS necessidade_identificada text,
  ADD COLUMN IF NOT EXISTS escopo text,
  ADD COLUMN IF NOT EXISTS custos_estimados numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_proposta numeric(12,2),
  ADD COLUMN IF NOT EXISTS apresentacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS condicoes_pagamento text,
  ADD COLUMN IF NOT EXISTS resultado_final text,
  ADD COLUMN IF NOT EXISTS motivo_encerramento text,
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS etapa_legada text;

-- Remove a restrição antiga de etapa (nome gerado automaticamente).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.partner_leads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%etapa%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_leads DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3) Conversão das etapas antigas (antes de criar os gatilhos)
--    lead             -> novo
--    contato_feito    -> primeiro_contato
--    proposta_enviada -> proposta (aguardando decisão)
--    fechado          -> ganho
--    perdido          -> perdido
-- ---------------------------------------------------------------------
UPDATE public.partner_leads
SET etapa_legada = etapa
WHERE etapa_legada IS NULL
  AND etapa IN ('lead','contato_feito','proposta_enviada','fechado','perdido');

UPDATE public.partner_leads SET etapa = 'novo' WHERE etapa = 'lead';
UPDATE public.partner_leads SET etapa = 'primeiro_contato' WHERE etapa = 'contato_feito';
UPDATE public.partner_leads
  SET etapa = 'proposta', subetapa = COALESCE(subetapa, 'aguardando_decisao')
  WHERE etapa = 'proposta_enviada';
UPDATE public.partner_leads
  SET etapa = 'ganho',
      resultado_final = 'ganho',
      encerrado_em = COALESCE(encerrado_em, updated_at)
  WHERE etapa = 'fechado';
UPDATE public.partner_leads
  SET resultado_final = 'perdido',
      encerrado_em = COALESCE(encerrado_em, updated_at)
  WHERE etapa = 'perdido';

-- Leads antigos ficam com quem os cadastrou como responsável.
UPDATE public.partner_leads SET responsavel_id = created_by WHERE responsavel_id IS NULL;

ALTER TABLE public.partner_leads ALTER COLUMN etapa SET DEFAULT 'novo';

ALTER TABLE public.partner_leads
  ADD CONSTRAINT partner_leads_etapa_check CHECK (etapa IN (
    'novo','primeiro_contato','cadencia','reuniao','diagnostico','proposta',
    'negociacao','contrato','ganho','perdido','sem_resposta','contrato_nao_concluido'
  )),
  ADD CONSTRAINT partner_leads_canal_origem_check CHECK (canal_origem IS NULL OR canal_origem IN (
    'indicacao','instagram','site','linkedin','whatsapp','evento','prospeccao_ativa','outro'
  )),
  ADD CONSTRAINT partner_leads_resultado_primeira_ligacao_check CHECK (resultado_primeira_ligacao IS NULL OR resultado_primeira_ligacao IN (
    'atendeu','nao_atendeu','pediu_retorno','respondeu_whatsapp','reuniao_marcada','sem_interesse'
  )),
  ADD CONSTRAINT partner_leads_cadencia_status_check CHECK (cadencia_status IS NULL OR cadencia_status IN (
    'ativa','respondida','interrompida','encerrada','optout'
  )),
  ADD CONSTRAINT partner_leads_reuniao_status_check CHECK (reuniao_status IS NULL OR reuniao_status IN (
    'agendada','realizada','reagendada','cancelada','no_show'
  )),
  ADD CONSTRAINT partner_leads_resultado_final_check CHECK (resultado_final IS NULL OR resultado_final IN (
    'ganho','perdido','sem_resposta','contrato_nao_concluido'
  ));

CREATE INDEX IF NOT EXISTS idx_partner_leads_responsavel ON public.partner_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_partner_leads_etapa ON public.partner_leads(etapa);
CREATE INDEX IF NOT EXISTS idx_partner_leads_lembrete ON public.partner_leads(data_lembrete)
  WHERE data_lembrete IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4) Permissões de partner_leads
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR (
      public.has_commercial_access(_user_id)
      AND EXISTS (
        SELECT 1 FROM public.partner_leads l
        WHERE l.id = _lead_id AND l.responsavel_id = _user_id
      )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_lead(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_lead(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "socios_leads_all" ON public.partner_leads;
DROP POLICY IF EXISTS "leads_select" ON public.partner_leads;
DROP POLICY IF EXISTS "leads_insert" ON public.partner_leads;
DROP POLICY IF EXISTS "leads_update" ON public.partner_leads;
DROP POLICY IF EXISTS "leads_delete" ON public.partner_leads;

CREATE POLICY "leads_select" ON public.partner_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (responsavel_id = auth.uid() AND public.has_commercial_access(auth.uid()))
  );

CREATE POLICY "leads_insert" ON public.partner_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      created_by = auth.uid()
      AND responsavel_id = auth.uid()
      AND public.has_commercial_access(auth.uid())
    )
  );

-- O WITH CHECK impede que um colaborador repasse o lead para outra pessoa.
CREATE POLICY "leads_update" ON public.partner_leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (responsavel_id = auth.uid() AND public.has_commercial_access(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (responsavel_id = auth.uid() AND public.has_commercial_access(auth.uid()))
  );

CREATE POLICY "leads_delete" ON public.partner_leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 5) Histórico / atividades do lead
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.partner_leads(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'ligacao','whatsapp','email','resposta','reuniao','marco',
    'decisao','mudanca_etapa','nota','sistema','encerramento'
  )),
  status text NOT NULL DEFAULT 'realizada' CHECK (status IN ('prevista','realizada','cancelada')),
  titulo text NOT NULL,
  resultado text,
  observacoes text,
  canal text,
  chave text,
  ciclo integer,
  etapa_de text,
  etapa_para text,
  previsto_para timestamptz,
  realizado_em timestamptz,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Uma ação só é "realizada" com data/hora de realização; uma prevista precisa de data.
  CONSTRAINT lead_activities_realizada_check CHECK (status <> 'realizada' OR realizado_em IS NOT NULL),
  CONSTRAINT lead_activities_prevista_check CHECK (status <> 'prevista' OR previsto_para IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON public.lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_pending ON public.lead_activities(lead_id)
  WHERE status = 'prevista';
-- Evita duplicidade: o mesmo template/marco previsto duas vezes, ou o mesmo
-- template registrado como enviado duas vezes no mesmo ciclo de cadência.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_activities_prevista_chave
  ON public.lead_activities(lead_id, chave)
  WHERE status = 'prevista' AND chave IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_activities_whatsapp_enviado
  ON public.lead_activities(lead_id, ciclo, chave)
  WHERE status = 'realizada' AND tipo = 'whatsapp' AND chave IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_activities_select" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (public.can_access_lead(auth.uid(), lead_id));
CREATE POLICY "lead_activities_insert" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_lead(auth.uid(), lead_id));
CREATE POLICY "lead_activities_update" ON public.lead_activities
  FOR UPDATE TO authenticated
  USING (public.can_access_lead(auth.uid(), lead_id))
  WITH CHECK (public.can_access_lead(auth.uid(), lead_id));
CREATE POLICY "lead_activities_delete" ON public.lead_activities
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_lead_activities_updated BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico inicial dos leads existentes (antes dos gatilhos, sem duplicar).
INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, etapa_para, realizado_em, responsavel_id, created_by, created_at)
SELECT l.id, 'sistema', 'realizada', 'Lead registrado no CRM',
       COALESCE(l.etapa_legada, l.etapa), l.created_at, l.created_by, l.created_by, l.created_at
FROM public.partner_leads l
WHERE NOT EXISTS (SELECT 1 FROM public.lead_activities a WHERE a.lead_id = l.id);

INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, observacoes, etapa_de, etapa_para, realizado_em, created_by)
SELECT l.id, 'mudanca_etapa', 'realizada', 'Migrado para o processo comercial TO BE',
       'Etapa anterior no funil da Central dos Sócios: ' || l.etapa_legada,
       l.etapa_legada, l.etapa, now(), NULL
FROM public.partner_leads l
WHERE l.etapa_legada IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_activities a
    WHERE a.lead_id = l.id AND a.tipo = 'mudanca_etapa' AND a.etapa_de = l.etapa_legada
  );

-- ---------------------------------------------------------------------
-- 6) Gatilhos de consistência entre funil e linha do tempo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_leads_before_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;

  IF NEW.etapa IN ('ganho','perdido','sem_resposta','contrato_nao_concluido') THEN
    NEW.resultado_final := NEW.etapa;
    NEW.encerrado_em := COALESCE(NEW.encerrado_em, now());
    -- Só limpa a próxima ação no momento do encerramento, para não apagar
    -- dados de leads que já estavam encerrados antes desta migração.
    IF TG_OP = 'INSERT' OR OLD.etapa NOT IN ('ganho','perdido','sem_resposta','contrato_nao_concluido') THEN
      NEW.data_lembrete := NULL;
      NEW.proximo_passo := NULL;
      NEW.proxima_acao_responsavel_id := NULL;
    END IF;
    IF NEW.cadencia_status = 'ativa' THEN
      NEW.cadencia_status := 'encerrada';
    END IF;
  ELSE
    -- Lead reaberto: limpa o resultado final.
    NEW.resultado_final := NULL;
    NEW.encerrado_em := NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.etapa = 'cadencia' AND NEW.etapa <> 'cadencia'
     AND NEW.cadencia_status = 'ativa' THEN
    NEW.cadencia_status := 'interrompida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_leads_before_write ON public.partner_leads;
CREATE TRIGGER trg_partner_leads_before_write
  BEFORE INSERT OR UPDATE ON public.partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.partner_leads_before_write();

CREATE OR REPLACE FUNCTION public.partner_leads_after_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, etapa_para, realizado_em, responsavel_id)
    VALUES (NEW.id, 'sistema', 'realizada', 'Lead registrado no CRM', NEW.etapa, now(), auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    -- Registro único da mudança de etapa: o funil e a linha do tempo não divergem.
    INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, observacoes, etapa_de, etapa_para, realizado_em, responsavel_id)
    VALUES (
      NEW.id, 'mudanca_etapa', 'realizada', 'Mudança de etapa',
      CASE
        WHEN OLD.proximo_passo IS NOT NULL AND NEW.proximo_passo IS NULL
          THEN 'Próxima ação encerrada: ' || OLD.proximo_passo
            || COALESCE(' (até ' || to_char(OLD.data_lembrete, 'DD/MM/YYYY') || ')', '')
      END,
      OLD.etapa, NEW.etapa, now(), auth.uid()
    );

    IF NEW.etapa IN ('ganho','perdido','sem_resposta','contrato_nao_concluido') THEN
      -- Lead encerrado: nenhum lembrete pendente continua fazendo sentido.
      UPDATE public.lead_activities
        SET status = 'cancelada',
            observacoes = COALESCE(observacoes || E'\n', '') || 'Cancelada automaticamente: lead encerrado.'
        WHERE lead_id = NEW.id AND status = 'prevista';
    ELSIF OLD.etapa = 'cadencia' THEN
      -- Saiu da cadência: mensagens pendentes deixam de valer.
      UPDATE public.lead_activities
        SET status = 'cancelada',
            observacoes = COALESCE(observacoes || E'\n', '') || 'Cancelada automaticamente: cadência interrompida.'
        WHERE lead_id = NEW.id AND status = 'prevista'
          AND (tipo = 'whatsapp' OR chave = 'encerrar_cadencia');
    END IF;
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, realizado_em, responsavel_id)
    VALUES (NEW.id, 'sistema', 'realizada', 'Responsável comercial alterado', now(), auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_leads_after_write ON public.partner_leads;
CREATE TRIGGER trg_partner_leads_after_write
  AFTER INSERT OR UPDATE ON public.partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.partner_leads_after_write();

-- ---------------------------------------------------------------------
-- 7) Operação atômica: atualiza o lead, conclui/cancela ações e registra
--    novas atividades numa única transação. Roda com as permissões de
--    quem chama (SECURITY INVOKER), então o RLS continua valendo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_apply_changes(
  _lead_id uuid,
  _patch jsonb DEFAULT '{}'::jsonb,
  _activities jsonb DEFAULT '[]'::jsonb,
  _activity_updates jsonb DEFAULT '[]'::jsonb,
  _cancel_pending boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  r public.partner_leads%ROWTYPE;
  touched uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO r FROM public.partner_leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado ou sem permissão';
  END IF;

  -- 1) Conclui, remarca ou cancela ações já existentes.
  IF jsonb_typeof(_activity_updates) = 'array' AND jsonb_array_length(_activity_updates) > 0 THEN
    WITH upd AS (
      UPDATE public.lead_activities la SET
        status = COALESCE(u.status, la.status),
        titulo = COALESCE(u.titulo, la.titulo),
        realizado_em = CASE
          WHEN COALESCE(u.status, la.status) = 'realizada' THEN COALESCE(u.realizado_em, la.realizado_em, now())
          ELSE la.realizado_em END,
        previsto_para = COALESCE(u.previsto_para, la.previsto_para),
        resultado = COALESCE(u.resultado, la.resultado),
        observacoes = COALESCE(u.observacoes, la.observacoes),
        canal = COALESCE(u.canal, la.canal),
        responsavel_id = CASE
          WHEN COALESCE(u.status, la.status) = 'realizada' AND la.status <> 'realizada' THEN auth.uid()
          ELSE COALESCE(u.responsavel_id, la.responsavel_id) END
      FROM jsonb_to_recordset(_activity_updates) AS u(
        id uuid, status text, titulo text, realizado_em timestamptz, previsto_para timestamptz,
        resultado text, observacoes text, canal text, responsavel_id uuid
      )
      WHERE la.id = u.id AND la.lead_id = _lead_id
      RETURNING la.id
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO touched FROM upd;
  END IF;

  -- 2) Cancela o que perdeu o sentido (resposta, remarcação etc.).
  IF _cancel_pending THEN
    UPDATE public.lead_activities
      SET status = 'cancelada'
      WHERE lead_id = _lead_id AND status = 'prevista' AND NOT (id = ANY(touched));
  END IF;

  -- 3) Atualiza o lead (os gatilhos registram mudança de etapa).
  IF _patch IS NOT NULL AND _patch <> '{}'::jsonb THEN
    r := jsonb_populate_record(r, _patch);
    UPDATE public.partner_leads SET
      nome = r.nome,
      empresa = r.empresa,
      contato = r.contato,
      telefone = r.telefone,
      origem = r.origem,
      canal_origem = r.canal_origem,
      etapa = r.etapa,
      subetapa = r.subetapa,
      proximo_passo = r.proximo_passo,
      data_lembrete = r.data_lembrete,
      proxima_acao_responsavel_id = r.proxima_acao_responsavel_id,
      valor_estimado = r.valor_estimado,
      client_id = r.client_id,
      observacoes = r.observacoes,
      necessidade_inicial = r.necessidade_inicial,
      responsavel_id = r.responsavel_id,
      data_primeiro_contato = r.data_primeiro_contato,
      resultado_primeira_ligacao = r.resultado_primeira_ligacao,
      cadencia_status = r.cadencia_status,
      cadencia_ciclo = r.cadencia_ciclo,
      nao_contatar = r.nao_contatar,
      reuniao_em = r.reuniao_em,
      reuniao_status = r.reuniao_status,
      reuniao_local = r.reuniao_local,
      necessidade_identificada = r.necessidade_identificada,
      escopo = r.escopo,
      custos_estimados = r.custos_estimados,
      valor_proposta = r.valor_proposta,
      apresentacao_em = r.apresentacao_em,
      condicoes_pagamento = r.condicoes_pagamento,
      motivo_encerramento = r.motivo_encerramento
    WHERE id = _lead_id;
  END IF;

  -- 4) Registra as novas atividades (realizadas ou previstas).
  IF jsonb_typeof(_activities) = 'array' AND jsonb_array_length(_activities) > 0 THEN
    INSERT INTO public.lead_activities (
      lead_id, tipo, status, titulo, resultado, observacoes, canal, chave, ciclo,
      previsto_para, realizado_em, responsavel_id
    )
    SELECT
      _lead_id, a.tipo, COALESCE(a.status, 'realizada'), a.titulo, a.resultado, a.observacoes,
      a.canal, a.chave, a.ciclo, a.previsto_para,
      CASE WHEN COALESCE(a.status, 'realizada') = 'realizada' THEN COALESCE(a.realizado_em, now()) END,
      COALESCE(a.responsavel_id, auth.uid())
    FROM jsonb_to_recordset(_activities) AS a(
      tipo text, status text, titulo text, resultado text, observacoes text, canal text,
      chave text, ciclo integer, previsto_para timestamptz, realizado_em timestamptz,
      responsavel_id uuid
    );
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lead_apply_changes(uuid, jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_apply_changes(uuid, jsonb, jsonb, jsonb, boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- 8) Modelos de mensagem (editáveis pelos admins)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_message_templates (
  chave text PRIMARY KEY,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  orientacao text,
  espera_dias_uteis integer NOT NULL DEFAULT 0 CHECK (espera_dias_uteis >= 0),
  na_cadencia boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_message_templates TO authenticated;
GRANT ALL ON public.lead_message_templates TO service_role;
ALTER TABLE public.lead_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_templates_select" ON public.lead_message_templates
  FOR SELECT TO authenticated
  USING (public.has_commercial_access(auth.uid()));
CREATE POLICY "lead_templates_admin_write" ON public.lead_message_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_lead_templates_updated BEFORE UPDATE ON public.lead_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- espera_dias_uteis = dias úteis sem resposta, após o envio, até a próxima etapa.
INSERT INTO public.lead_message_templates (chave, ordem, titulo, conteudo, orientacao, espera_dias_uteis, na_cadencia) VALUES
('template_1', 1, 'Primeiro template',
'Oi, [nome]! Tudo bem? Aqui é [seu nome], da DPlay Solutions.
Conheci a [empresa] por [origem real do contato]. A gente ajuda empresas a organizar processos com sistemas e automações, e queria entender uma coisa: hoje vocês têm alguma atividade que ainda depende muito de planilhas, mensagens ou trabalho manual?
Se fizer sentido, posso te ligar por uns 5 minutos para entender melhor como funciona por aí.',
'Use [informação observada] apenas quando houver um dado real sobre a empresa. Se o lead responder em qualquer etapa, interrompa a cadência e conduza a conversa conforme a necessidade apresentada.',
1, true),
('template_2', 2, 'Segundo template',
'Oi, [nome]! Passando para retomar minha mensagem.
Perguntei porque, em algumas empresas, informações de clientes, pedidos ou tarefas acabam espalhadas entre WhatsApp e planilhas. Existe algum processo na [empresa] que vocês gostariam de organizar melhor?
Se preferir, podemos conversar rapidamente por ligação. [Dia/horário] funciona para você?',
NULL, 2, true),
('template_3', 3, 'Terceiro template',
'Oi, [nome]! Para ficar mais claro o tipo de trabalho que fazemos, vou deixar aqui [link da apresentação institucional].
A DPlay desenvolve soluções conforme a necessidade de cada empresa, como sistemas para centralizar informações e automações para reduzir tarefas repetitivas. Algum desses pontos tem relação com o momento da [empresa]?',
NULL, 2, true),
('template_4', 4, 'Quarto template',
'Oii LEAD, boa tarde ou bom dia! Tudo bem?
Estou fazendo o fechamento da agenda das empresas que vamos acompanhar essa semana e queria incluir o diagnóstico da [Nome da empresa] nesse ciclo.
Ainda consigo incluir a tua empresa, se quiser que a gente entenda juntos os pontos de melhoria.
Se achar que faz sentido, eu te ligo e em 5-7 minutos te explico como funciona, ou se preferir pode me ligar assim que vir essa mensagem!',
NULL, 3, true),
('break_up', 5, 'Break-up',
'Opa, LEAD! Tudo certo?
Acredito que você esteja com outras prioridades no momento, é uma pena pois vejo que teríamos ótimos resultados trabalhando juntos, por isso eu gostaria de entender melhor a situação da [Nome da empresa] para poder aliviar a sobrecarga e ajudar da melhor forma.
Eu não quero ser um incômodo pra você. Por isso, vou parar de falar por aqui. De qualquer forma fico à disposição caso queira entrar em contato! Pode falar por aqui mesmo ou também, pelo meu email: [seu email].
Obrigado pela atenção!',
'Se não responder em 2 dias úteis, encerre a cadência como "Sem resposta", mantendo o histórico para uma eventual retomada. Não envie outra mensagem nesse intervalo.',
2, true),
('no_show', 10, 'No-show da reunião',
'Oi, [nome]! Tudo bem? Senti sua falta na nossa reunião de diagnóstico. Imagino que tenha surgido algum imprevisto.
Podemos remarcar? Tenho [dia e horário] ou [dia e horário]. Qual fica melhor para você?',
'Modelo sugerido para o passo "Enviar template de no-show" do fluxograma (não consta no roteiro). Revise antes de usar.',
0, false)
ON CONFLICT (chave) DO NOTHING;

-- ---------------------------------------------------------------------
-- 9) Lembretes no sino: usa as novas etapas, avisa o responsável e
--    aponta para a nova página.
-- ---------------------------------------------------------------------
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
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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

  -- Leads com próxima ação para hoje ou atrasada, notificados uma vez por dia.
  -- Vai para o responsável (se ainda tiver acesso); senão, para os admins.
  FOR rec IN
    SELECT l.id, l.nome, l.proximo_passo,
           COALESCE(l.proxima_acao_responsavel_id, l.responsavel_id) AS dono
    FROM public.partner_leads l
    WHERE l.data_lembrete IS NOT NULL
      AND l.data_lembrete <= hoje
      AND l.etapa NOT IN ('ganho','perdido','sem_resposta','contrato_nao_concluido')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.tipo = 'lead_followup'
          AND n.link = '/leads/' || l.id::text
          AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date = hoje
      )
  LOOP
    IF rec.dono IS NOT NULL AND public.has_commercial_access(rec.dono) THEN
      INSERT INTO public.notifications (user_id, tipo, titulo, link)
      VALUES (rec.dono, 'lead_followup',
              'Follow-up: ' || rec.nome || COALESCE(' — ' || rec.proximo_passo, ''),
              '/leads/' || rec.id::text);
    ELSE
      INSERT INTO public.notifications (user_id, tipo, titulo, link)
      SELECT uid, 'lead_followup',
             'Follow-up: ' || rec.nome || COALESCE(' — ' || rec.proximo_passo, ''),
             '/leads/' || rec.id::text
      FROM unnest(admin_ids) AS uid;
    END IF;
    leads_sent := leads_sent + 1;
  END LOOP;

  RETURN jsonb_build_object('events', events_sent, 'leads', leads_sent);
END;
$$;

NOTIFY pgrst, 'reload schema';
