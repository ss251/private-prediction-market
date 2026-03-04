-- Widen market-count columns from smallint (max 32 767) to integer
-- to prevent overflow as the platform grows.

ALTER TABLE platform_stats
  ALTER COLUMN total_markets TYPE integer,
  ALTER COLUMN open_markets  TYPE integer;

ALTER TABLE indexer_state
  ALTER COLUMN last_market_count TYPE integer;
