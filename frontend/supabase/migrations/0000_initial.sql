-- Initial migration: prediction market tables
-- Generated from Drizzle schema + manual computed columns, RLS, seed data, realtime

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Markets: metadata + cached on-chain state
CREATE TABLE IF NOT EXISTS public.markets (
  market_id text PRIMARY KEY,
  -- Metadata (set by admin on creation)
  title text NOT NULL,
  description text DEFAULT '',
  category_id text DEFAULT 'other' REFERENCES public.categories(id),
  end_date text NOT NULL,
  resolution_source text DEFAULT '',
  tags text[] DEFAULT '{}',
  image_url text,
  -- Cached on-chain state (updated by indexer)
  status smallint DEFAULT 0,
  yes_pool bigint DEFAULT 0,
  no_pool bigint DEFAULT 0,
  outcome smallint,
  end_block bigint,
  paused boolean DEFAULT false,
  creator text,
  oracle_enabled boolean DEFAULT false,
  -- Timestamps
  created_at timestamp DEFAULT now(),
  chain_updated_at timestamp,
  metadata_updated_at timestamp DEFAULT now()
);

-- Computed columns (GENERATED ALWAYS AS)
ALTER TABLE public.markets
  ADD COLUMN total_volume bigint GENERATED ALWAYS AS (yes_pool + no_pool) STORED,
  ADD COLUMN yes_probability numeric GENERATED ALWAYS AS (
    CASE WHEN yes_pool + no_pool > 0
      THEN round(yes_pool::numeric / (yes_pool + no_pool), 4)
      ELSE 0.5
    END
  ) STORED;

-- Pool snapshots for price/volume charts
CREATE TABLE IF NOT EXISTS public.pool_snapshots (
  id serial PRIMARY KEY,
  market_id text NOT NULL REFERENCES public.markets(market_id),
  yes_pool bigint NOT NULL,
  no_pool bigint NOT NULL,
  total_volume bigint NOT NULL,
  yes_probability numeric NOT NULL,
  captured_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_market_time
  ON public.pool_snapshots(market_id, captured_at);

-- Platform-wide stats (singleton row)
CREATE TABLE IF NOT EXISTS public.platform_stats (
  id boolean PRIMARY KEY DEFAULT true,
  total_markets smallint DEFAULT 0,
  open_markets smallint DEFAULT 0,
  total_volume bigint DEFAULT 0,
  last_indexed_at timestamp
);

-- Indexer cursor (singleton row)
CREATE TABLE IF NOT EXISTS public.indexer_state (
  id boolean PRIMARY KEY DEFAULT true,
  last_market_count smallint DEFAULT 0,
  last_run_at timestamp,
  last_error text
);

-- ══════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexer_state ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.markets FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.pool_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.platform_stats FOR SELECT USING (true);

-- Service role write access (indexer + edge functions)
CREATE POLICY "Service write" ON public.markets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON public.pool_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON public.platform_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON public.indexer_state FOR ALL USING (auth.role() = 'service_role');

-- Anonymous users can insert metadata (called from frontend after market creation)
CREATE POLICY "Anon insert metadata" ON public.markets FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- Seed data
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.categories (id, name, slug) VALUES
  ('crypto', 'Crypto', 'crypto'),
  ('sports', 'Sports', 'sports'),
  ('politics', 'Politics', 'politics'),
  ('tech', 'Technology', 'tech'),
  ('other', 'Other', 'other')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_stats (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.indexer_state (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.markets (market_id, title, end_date, category_id, description) VALUES
  ('1field', 'Will Bitcoin exceed $120K by end of January 2026?', '2026-01-31', 'crypto', 'Resolves YES if BTC/USD spot price exceeds $120,000 at any point before January 31, 2026 23:59 UTC.'),
  ('2field', 'Will Bitcoin hit $150K before July 2026?', '2026-06-30', 'crypto', 'Resolves YES if BTC/USD spot price on any major exchange exceeds $150,000 before June 30, 2026.'),
  ('3field', 'Will there be a US federal government shutdown before April 2026?', '2026-03-31', 'politics', 'Resolves YES if a partial or full US federal government shutdown occurs before March 31, 2026.'),
  ('4field', 'Will OpenAI IPO in 2026?', '2026-12-31', 'tech', 'Resolves YES if OpenAI completes an IPO or direct listing on any major stock exchange by December 31, 2026.'),
  ('5field', 'Will Tesla launch unsupervised FSD in any US state by June 2026?', '2026-06-30', 'tech', 'Resolves YES if Tesla launches fully unsupervised Full Self-Driving available to consumers in at least one US state.'),
  ('6field', 'Will the Fed cut rates by 50+ basis points by June 2026?', '2026-06-30', 'other', 'Resolves YES if cumulative Federal Reserve rate cuts from January 2026 total 50 bps or more by June 30, 2026.')
ON CONFLICT (market_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- Realtime
-- ══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.markets;
