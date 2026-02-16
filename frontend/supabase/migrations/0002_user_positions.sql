-- User positions: indexed from on-chain bet transactions
-- Eliminates need for requestRecords() wallet popup

CREATE TABLE IF NOT EXISTS public.user_positions (
  id serial PRIMARY KEY,
  wallet_address text NOT NULL,
  market_id text NOT NULL REFERENCES public.markets(market_id),
  yes_amount bigint NOT NULL DEFAULT 0,
  no_amount bigint NOT NULL DEFAULT 0,
  updated_at timestamp DEFAULT now(),
  UNIQUE(wallet_address, market_id)
);

CREATE INDEX IF NOT EXISTS idx_user_positions_wallet
  ON public.user_positions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_user_positions_market
  ON public.user_positions(market_id);

-- RLS
ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.user_positions FOR SELECT USING (true);
CREATE POLICY "Service write" ON public.user_positions FOR ALL USING (auth.role() = 'service_role');
-- Allow anon inserts (frontend reports positions after bet)
CREATE POLICY "Anon upsert" ON public.user_positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.user_positions FOR UPDATE USING (true);
