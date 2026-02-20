-- Function: close_expired_markets
-- Finds markets where status=0 (open) and end_date < now(),
-- aggregates user_positions into yes_pool/no_pool, and sets status=1 (closed).
-- Returns the number of markets closed.
CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  closed_count integer := 0;
  market_row RECORD;
  agg RECORD;
BEGIN
  FOR market_row IN
    SELECT market_id FROM markets
    WHERE status = 0 AND end_date < now()
  LOOP
    -- Aggregate user positions for this market
    SELECT
      COALESCE(SUM(yes_amount), 0) AS total_yes,
      COALESCE(SUM(no_amount), 0) AS total_no
    INTO agg
    FROM user_positions
    WHERE market_id = market_row.market_id;

    -- Update market: set pools and close
    UPDATE markets
    SET
      yes_pool = agg.total_yes,
      no_pool = agg.total_no,
      status = 1
    WHERE market_id = market_row.market_id;

    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$$;
