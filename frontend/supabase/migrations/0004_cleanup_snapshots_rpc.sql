-- Creates the cleanup_old_snapshots RPC used by the cleanup-snapshots edge function.
-- Deletes granular snapshots older than `cutoff`, keeping one per hour per market.

CREATE OR REPLACE FUNCTION cleanup_old_snapshots(cutoff timestamptz)
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM pool_snapshots
  WHERE id IN (
    SELECT id FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY market_id, DATE_TRUNC('hour', captured_at)
          ORDER BY captured_at
        ) AS rn
      FROM pool_snapshots
      WHERE captured_at < cutoff
    ) ranked
    WHERE rn > 1
  );
$$;
