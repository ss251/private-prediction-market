-- Track blinding factor sums per market for Pedersen commitment verification at resolution.
-- Each bet contributes nonce_value (for the chosen side) and nonce_value+1 (for the other side).
-- These sums are needed by the admin to call resolve_market with valid blinding scalars.

CREATE TABLE IF NOT EXISTS public.market_blindings (
  market_id text PRIMARY KEY REFERENCES public.markets(market_id),
  sum_blinding_yes text NOT NULL DEFAULT '0',  -- stored as decimal string (u128 range)
  sum_blinding_no text NOT NULL DEFAULT '0',
  updated_at timestamp DEFAULT now()
);

ALTER TABLE public.market_blindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.market_blindings FOR SELECT USING (true);
CREATE POLICY "Anon upsert" ON public.market_blindings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.market_blindings FOR UPDATE USING (true);
CREATE POLICY "Service write" ON public.market_blindings FOR ALL USING (auth.role() = 'service_role');
