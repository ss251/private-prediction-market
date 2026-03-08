-- #22: Widen market count columns from smallint (max 32,767) to integer (max 2.1B)
-- to match on-chain u64 market_count and prevent indexer failures at scale.

ALTER TABLE public.platform_stats
  ALTER COLUMN total_markets TYPE integer,
  ALTER COLUMN open_markets TYPE integer;

ALTER TABLE public.indexer_state
  ALTER COLUMN last_market_count TYPE integer;

-- #16: Create the missing cleanup_old_snapshots RPC function.
-- Called by cleanup-snapshots edge function (daily cron) to prune granular
-- snapshots while keeping one per hour per market for data older than cutoff.

CREATE OR REPLACE FUNCTION cleanup_old_snapshots(cutoff timestamp)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM pool_snapshots
  WHERE id IN (
    SELECT id FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY
            market_id,
            DATE_TRUNC('hour', captured_at)
          ORDER BY captured_at ASC
        ) AS rn
      FROM pool_snapshots
      WHERE captured_at < cutoff
    ) ranked
    WHERE rn > 1
  );
END;
$$;
