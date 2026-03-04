CREATE OR REPLACE FUNCTION increment_pool(p_market_id text, p_outcome boolean, p_amount bigint)
RETURNS void AS $$
BEGIN
  UPDATE markets
  SET
    yes_pool = CASE WHEN p_outcome THEN yes_pool + p_amount ELSE yes_pool END,
    no_pool  = CASE WHEN NOT p_outcome THEN no_pool + p_amount ELSE no_pool END,
    chain_updated_at = now()
  WHERE market_id = p_market_id;
END;
$$ LANGUAGE plpgsql;
