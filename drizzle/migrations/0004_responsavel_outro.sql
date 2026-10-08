-- Responsável "Outro" (nome digitado), pessoas fora da lista de responsáveis
-- e ajustes de consistência no processo comercial.

-- ---------------------------------------------------------------------
-- 1) Responsável externo: nome digitado quando o lead é de "Outro".
-- ---------------------------------------------------------------------
ALTER TABLE public.partner_leads
  ADD COLUMN IF NOT EXISTS responsavel_externo text;

-- ---------------------------------------------------------------------
-- 2) Pessoas que não aparecem na lista de responsáveis (ex.: contas da
--    empresa). Leitura para o comercial; escrita só por admin, via RPC.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_owner_hidden (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hidden_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commercial_owner_hidden TO authenticated;
GRANT ALL ON public.commercial_owner_hidden TO service_role;
ALTER TABLE public.commercial_owner_hidden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_owner_hidden_select" ON public.commercial_owner_hidden;
CREATE POLICY "commercial_owner_hidden_select" ON public.commercial_owner_hidden
  FOR SELECT TO authenticated
  USING (public.has_commercial_access(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_set_lead_owner_visible(_user_id uuid, _visible boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admin';
  END IF;
  IF _visible THEN
    DELETE FROM public.commercial_owner_hidden WHERE user_id = _user_id;
  ELSE
    INSERT INTO public.commercial_owner_hidden (user_id, hidden_by)
    VALUES (_user_id, auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_lead_owner_visible(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_lead_owner_visible(uuid, boolean) TO authenticated;

-- A conta da empresa ("Produtiva JR") sai da lista. Dá para desfazer em Equipe.
INSERT INTO public.commercial_owner_hidden (user_id)
SELECT p.id FROM public.profiles p
WHERE lower(trim(p.nome)) = 'produtiva jr'
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3) Gatilhos: troca de responsável leva junto a próxima ação e as ações
--    previstas; "Outro" é registrado na linha do tempo.
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

  -- Troca de responsável: a próxima ação que era do antigo dono passa ao novo.
  IF TG_OP = 'UPDATE'
     AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     AND NEW.proxima_acao_responsavel_id IS NOT DISTINCT FROM OLD.proxima_acao_responsavel_id
     AND OLD.proxima_acao_responsavel_id IS NOT DISTINCT FROM OLD.responsavel_id THEN
    NEW.proxima_acao_responsavel_id := NEW.responsavel_id;
  END IF;

  -- "Outro" (nome digitado) e usuário do sistema não convivem.
  IF NEW.responsavel_id IS NOT NULL THEN
    NEW.responsavel_externo := NULL;
  ELSE
    NEW.responsavel_externo := NULLIF(trim(NEW.responsavel_externo), '');
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.etapa = 'cadencia' AND NEW.etapa <> 'cadencia'
     AND NEW.cadencia_status = 'ativa' THEN
    NEW.cadencia_status := 'interrompida';
  END IF;

  RETURN NEW;
END;
$$;

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

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     OR NEW.responsavel_externo IS DISTINCT FROM OLD.responsavel_externo THEN
    INSERT INTO public.lead_activities (lead_id, tipo, status, titulo, observacoes, realizado_em, responsavel_id)
    VALUES (
      NEW.id, 'sistema', 'realizada', 'Responsável comercial alterado',
      CASE WHEN NEW.responsavel_externo IS NOT NULL THEN 'Outro: ' || NEW.responsavel_externo END,
      now(), auth.uid()
    );
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    -- Ações previstas do antigo responsável passam ao novo (agenda e lembretes).
    UPDATE public.lead_activities
      SET responsavel_id = NEW.responsavel_id
      WHERE lead_id = NEW.id AND status = 'prevista'
        AND responsavel_id IS NOT DISTINCT FROM OLD.responsavel_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 4) lead_apply_changes passa a gravar o responsável externo e a data de
--    encerramento informada (antes sempre virava "agora").
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
      responsavel_externo = r.responsavel_externo,
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
      motivo_encerramento = r.motivo_encerramento,
      encerrado_em = r.encerrado_em
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

NOTIFY pgrst, 'reload schema';
