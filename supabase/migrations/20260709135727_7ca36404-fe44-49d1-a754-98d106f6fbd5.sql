ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS nf_emitida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nf_numero text;
ALTER TABLE public.sale_subscriptions
  ADD COLUMN IF NOT EXISTS nf_emitida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nf_numero text;