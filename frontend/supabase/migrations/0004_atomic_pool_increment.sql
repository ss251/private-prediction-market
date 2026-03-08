-- Atomic pool increment RPC to prevent race conditions on concurrent bets.
-- Replaces the read-then-write pattern in the frontend's incrementPoolTotal().

CREATE OR REPLACE FUNCTION increment_pool_total(
  p_market_id text,
  p_outcome boolean,
  p_amount bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_outcome THEN
    UPDATE public.markets
      SET yes_pool = yes_pool + p_amount,
          chain_updated_at = now()
      WHERE market_id = p_market_id;
  ELSE
    UPDATE public.markets
      SET no_pool = no_pool + p_amount,
          chain_updated_at = now()
      WHERE market_id = p_market_id;
  END IF;
END;
$$;
