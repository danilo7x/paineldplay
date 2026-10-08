-- =====================================================================
-- Números de WhatsApp (instâncias da Evolution API) por pessoa.
-- A mensagem de um lead sai da instância do responsável pelo lead.
-- Só o nome da instância fica aqui; a chave da Evolution continua nos
-- segredos do servidor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.commercial_whatsapp_instances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instance text NOT NULL CHECK (length(trim(instance)) > 0),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commercial_whatsapp_instances TO authenticated;
GRANT ALL ON public.commercial_whatsapp_instances TO service_role;
ALTER TABLE public.commercial_whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_instances_select" ON public.commercial_whatsapp_instances;
CREATE POLICY "whatsapp_instances_select" ON public.commercial_whatsapp_instances
  FOR SELECT TO authenticated
  USING (public.has_commercial_access(auth.uid()));
-- Escrita apenas via admin_set_whatsapp_instance: ninguém aponta o próprio
-- usuário para o número de outra pessoa.

CREATE OR REPLACE FUNCTION public.admin_set_whatsapp_instance(_user_id uuid, _instance text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admin';
  END IF;
  IF _instance IS NULL OR length(trim(_instance)) = 0 THEN
    DELETE FROM public.commercial_whatsapp_instances WHERE user_id = _user_id;
  ELSE
    INSERT INTO public.commercial_whatsapp_instances (user_id, instance, updated_by, updated_at)
    VALUES (_user_id, trim(_instance), auth.uid(), now())
    ON CONFLICT (user_id) DO UPDATE
      SET instance = EXCLUDED.instance, updated_by = EXCLUDED.updated_by, updated_at = now();
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_whatsapp_instance(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_whatsapp_instance(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
