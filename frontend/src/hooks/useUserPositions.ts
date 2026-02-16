/**
 * User position tracking via Supabase indexed positions.
 *
 * Positions are stored in the `user_positions` table and updated when
 * bets are placed. No wallet popup or `requestRecords()` needed.
 * Falls back to localStorage positions if Supabase is unavailable.
 * @module
 */
import { useCallback, useState, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { fetchUserPositions } from "../lib/supabase";
import { getLocalPositionsForMarkets } from "../lib/localPositions";

/** Aggregated position for a single market. */
export interface OnChainPosition {
  marketId: string;
  yesAmount: bigint;
  noAmount: bigint;
}

/**
 * Returns user positions from Supabase (instant, no popup).
 * Falls back to localStorage if Supabase is unavailable.
 * Call `refetch()` to re-query after placing a bet.
 */
export function useUserPositions(marketIds: string[]) {
  const { address } = useWallet();
  const [data, setData] = useState<OnChainPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!address || marketIds.length === 0) {
      setData([]);
      setHasFetched(true);
      return;
    }

    setIsLoading(true);
    try {
      const supabasePositions = await fetchUserPositions(address, marketIds);

      if (supabasePositions.length > 0) {
        setData(
          supabasePositions.map((p) => ({
            marketId: p.marketId,
            yesAmount: BigInt(p.yesAmount),
            noAmount: BigInt(p.noAmount),
          }))
        );
      } else {
        // Fallback to localStorage
        const local = getLocalPositionsForMarkets(marketIds);
        setData(local);
      }
    } catch {
      // Supabase unavailable — fallback to localStorage
      const local = getLocalPositionsForMarkets(marketIds);
      setData(local);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [address, marketIds]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  /** Re-fetch positions (e.g., after placing a bet). */
  const refetch = useCallback(async () => {
    await fetchPositions();
  }, [fetchPositions]);

  return { data, isLoading, hasFetched, refetch };
}
