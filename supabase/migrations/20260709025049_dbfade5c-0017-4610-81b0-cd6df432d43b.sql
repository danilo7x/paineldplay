
-- ============ EXPENSES ============
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia text CHECK (recorrencia IN ('mensal','anual')),
  ADD COLUMN IF NOT EXISTS dia_cobranca int CHECK (dia_cobranca BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS recorrencia_ate date,
  ADD COLUMN IF NOT EXISTS origem_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_expenses_origem ON public.expenses(origem_id);
CREATE INDEX IF NOT EXISTS idx_expenses_data ON public.expenses(data);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_expenses_origem_data
  ON public.expenses(origem_id, data)
  WHERE origem_id IS NOT NULL;

-- ============ SALE SUBSCRIPTIONS ============
CREATE TABLE public.sale_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_email text,
  cliente_contato text,
  valor_inicial numeric NOT NULL DEFAULT 0,
  valor_mensal numeric NOT NULL CHECK (valor_mensal >= 0),
  dia_cobranca int NOT NULL CHECK (dia_cobranca BETWEEN 1 AND 31),
  data_inicio date NOT NULL,
  duracao_meses int CHECK (duracao_meses IS NULL OR duracao_meses > 0),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','encerrada')),
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_subscriptions TO authenticated;
GRANT ALL ON public.sale_subscriptions TO service_role;

ALTER TABLE public.sale_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_select"
  ON public.sale_subscriptions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'contador')
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "sub_insert"
  ON public.sale_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "sub_update"
  ON public.sale_subscriptions FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_project_member(auth.uid(), project_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "sub_delete"
  ON public.sale_subscriptions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_sale_subscriptions_updated_at
  BEFORE UPDATE ON public.sale_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SALES ============
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.sale_subscriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS competencia date;

CREATE INDEX IF NOT EXISTS idx_sales_subscription ON public.sales(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sales_data ON public.sales(data);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sales_subscription_competencia
  ON public.sales(subscription_id, competencia)
  WHERE subscription_id IS NOT NULL;

-- ============ GENERATION FUNCTION ============
CREATE OR REPLACE FUNCTION public.generate_recurrences()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := current_date;
  exp_row record;
  sub_row record;
  cur date;
  end_date date;
  target_date date;
  competencia date;
  safe_day int;
  expenses_inserted int := 0;
  sales_inserted int := 0;
  loop_guard int;
BEGIN
  -- === Despesas recorrentes ===
  FOR exp_row IN
    SELECT id, descricao, categoria, valor, data, project_id, created_by,
           recorrencia, dia_cobranca, recorrencia_ate
    FROM public.expenses
    WHERE recorrente = true
      AND origem_id IS NULL
      AND recorrencia IS NOT NULL
  LOOP
    end_date := LEAST(today, COALESCE(exp_row.recorrencia_ate, today));

    IF exp_row.recorrencia = 'mensal' THEN
      cur := (date_trunc('month', exp_row.data) + interval '1 month')::date;
      loop_guard := 0;
      WHILE cur <= end_date AND loop_guard < 600 LOOP
        safe_day := LEAST(
          COALESCE(exp_row.dia_cobranca, extract(day from exp_row.data)::int),
          extract(day from (date_trunc('month', cur) + interval '1 month - 1 day'))::int
        );
        target_date := make_date(
          extract(year from cur)::int,
          extract(month from cur)::int,
          safe_day
        );
        IF target_date <= end_date THEN
          BEGIN
            INSERT INTO public.expenses (descricao, categoria, valor, data, project_id, created_by, origem_id)
            VALUES (exp_row.descricao, exp_row.categoria, exp_row.valor, target_date, exp_row.project_id, exp_row.created_by, exp_row.id);
            expenses_inserted := expenses_inserted + 1;
          EXCEPTION WHEN unique_violation THEN
            NULL;
          END;
        END IF;
        cur := (cur + interval '1 month')::date;
        loop_guard := loop_guard + 1;
      END LOOP;

    ELSIF exp_row.recorrencia = 'anual' THEN
      cur := (exp_row.data + interval '1 year')::date;
      loop_guard := 0;
      WHILE cur <= end_date AND loop_guard < 50 LOOP
        BEGIN
          INSERT INTO public.expenses (descricao, categoria, valor, data, project_id, created_by, origem_id)
          VALUES (exp_row.descricao, exp_row.categoria, exp_row.valor, cur, exp_row.project_id, exp_row.created_by, exp_row.id);
          expenses_inserted := expenses_inserted + 1;
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
        cur := (cur + interval '1 year')::date;
        loop_guard := loop_guard + 1;
      END LOOP;
    END IF;
  END LOOP;

  -- === Assinaturas de venda ===
  FOR sub_row IN
    SELECT * FROM public.sale_subscriptions WHERE status = 'ativa'
  LOOP
    -- Entrada inicial (competência = mês de data_inicio)
    IF sub_row.valor_inicial > 0 THEN
      BEGIN
        INSERT INTO public.sales (
          project_id, client_id, cliente_nome, cliente_email, cliente_contato,
          valor, status, data, created_by, subscription_id, competencia
        ) VALUES (
          sub_row.project_id, sub_row.client_id, sub_row.cliente_nome, sub_row.cliente_email, sub_row.cliente_contato,
          sub_row.valor_inicial, 'pago', sub_row.data_inicio, sub_row.created_by, sub_row.id,
          date_trunc('month', sub_row.data_inicio)::date
        );
        sales_inserted := sales_inserted + 1;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END IF;

    -- Mensalidades
    end_date := today;
    IF sub_row.duracao_meses IS NOT NULL THEN
      end_date := LEAST(
        end_date,
        ((date_trunc('month', sub_row.data_inicio) + (sub_row.duracao_meses || ' months')::interval) - interval '1 day')::date
      );
    END IF;

    cur := date_trunc('month', sub_row.data_inicio)::date;
    loop_guard := 0;
    WHILE cur <= end_date AND loop_guard < 600 LOOP
      safe_day := LEAST(
        sub_row.dia_cobranca,
        extract(day from (cur + interval '1 month - 1 day'))::int
      );
      target_date := make_date(
        extract(year from cur)::int,
        extract(month from cur)::int,
        safe_day
      );
      IF target_date >= sub_row.data_inicio AND target_date <= today THEN
        competencia := date_trunc('month', target_date)::date;
        BEGIN
          INSERT INTO public.sales (
            project_id, client_id, cliente_nome, cliente_email, cliente_contato,
            valor, status, data, created_by, subscription_id, competencia
          ) VALUES (
            sub_row.project_id, sub_row.client_id, sub_row.cliente_nome, sub_row.cliente_email, sub_row.cliente_contato,
            sub_row.valor_mensal, 'pago', target_date, sub_row.created_by, sub_row.id, competencia
          );
          sales_inserted := sales_inserted + 1;
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
      cur := (cur + interval '1 month')::date;
      loop_guard := loop_guard + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'expenses_inserted', expenses_inserted,
    'sales_inserted', sales_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurrences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurrences() TO authenticated;
