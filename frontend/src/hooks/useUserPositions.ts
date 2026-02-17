/**
 * User position tracking via Supabase.
 *
 * Positions are stored in the `user_positions` table, populated when
 * bets are placed (frontend reports via `upsertUserPosition`) and
 * reconciled by the indexer every 60s. Loads instantly via a single
 * Supabase REST call — no wallet popup required.
 *
 * The optional `verifyOnChain()` method uses `requestRecords()` for
 * users who want cryptographic proof, but it's never called automatically.
 */
import { useCallback, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useQuery } from "@tanstack/react-query";
import { fetchUserPositions, upsertUserPositionFull } from "../lib/supabase";
import { PROGRAM_ID } from "../lib/aleo";

/** Aggregated on-chain position for a single market. */
export interface OnChainPosition {
  marketId: string;
  yesAmount: bigint;
  noAmount: bigint;
}

interface RawRecord {
  market_id?: string;
  outcome?: string;
  amount?: string;
}

/** Parse wallet records into positions (used only by verifyOnChain). */
function parseRecords(rawRecords: unknown[]): OnChainPosition[] {
  const byMarket = new Map<string, { yes: bigint; no: bigint }>();
  for (const rec of rawRecords) {
    try {
      const data = rec as RawRecord;
      if (!data.market_id || !data.amount) continue;
      // Keep the "field" suffix to match Supabase market_id format (e.g. "1field")
      let marketId = String(data.market_id).replace(/\.private$/, "").replace(/\.public$/, "");
      if (!marketId.endsWith("field")) marketId = marketId + "field";
      const outcome = String(data.outcome) === "true";
      const amount = BigInt(String(data.amount).replace(/u64$/, ""));
      const existing = byMarket.get(marketId) ?? { yes: 0n, no: 0n };
      if (outcome) existing.yes += amount;
      else existing.no += amount;
      byMarket.set(marketId, existing);
    } catch { continue; }
  }
  return Array.from(byMarket.entries()).map(([marketId, a]) => ({
    marketId,
    yesAmount: a.yes,
    noAmount: a.no,
  }));
}

/**
 * Hook for user positions backed by Supabase.
 *
 * Loads positions automatically when a wallet is connected —
 * no popup, no delay. Uses react-query for caching and refetching.
 *
 * @param marketIds - Market IDs to fetch positions for.
 */
export function useUserPositions(marketIds: string[]) {
  const { address, requestRecords } = useWallet();
  const [verifiedData, setVerifiedData] = useState<OnChainPosition[] | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Keep market IDs as-is (e.g. "1field") to match Supabase market_id format
  const normalizedIds = marketIds;

  // Primary: Supabase query (instant, no popup)
  const { data: supabasePositions, isLoading, refetch } = useQuery({
    queryKey: ["userPositions", address, normalizedIds.join(",")],
    queryFn: () => fetchUserPositions(address!, normalizedIds),
    enabled: !!address && normalizedIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Convert Supabase rows to OnChainPosition format
  const supabaseData: OnChainPosition[] = (supabasePositions ?? []).map((sp) => ({
    marketId: sp.marketId,
    yesAmount: BigInt(sp.yesAmount),
    noAmount: BigInt(sp.noAmount),
  }));

  const data: OnChainPosition[] = verifiedData ?? supabaseData;
  const hasFetched = !isLoading && !!address;

  /**
   * Sync positions from wallet records to Supabase.
   * Triggers a wallet popup, reads on-chain records, persists to DB,
   * then refetches so future loads are instant.
   */
  const syncFromChain = useCallback(async () => {
    if (!address || !requestRecords || marketIds.length === 0) return;
    setVerifyLoading(true);
    try {
      const rawRecords = await requestRecords(PROGRAM_ID);
      const positions = parseRecords(rawRecords as unknown[]);
      const relevant = positions.filter((p) => normalizedIds.includes(p.marketId));
      setVerifiedData(relevant);

      // Persist to Supabase so future loads are instant
      await Promise.all(
        relevant.map((p) => {
          const totalYes = Number(p.yesAmount);
          const totalNo = Number(p.noAmount);
          // Upsert with the full amounts (replace, not add)
          return upsertUserPositionFull(address, p.marketId, totalYes, totalNo);
        }),
      );

      // Refetch Supabase data so it's in sync
      await refetch();
    } catch {
      // User rejected wallet popup — keep existing data
    } finally {
      setVerifyLoading(false);
    }
  }, [address, requestRecords, marketIds, normalizedIds, refetch]);

  return {
    data,
    isLoading: isLoading || verifyLoading,
    hasFetched,
    refetch: async () => {
      setVerifiedData(null);
      await refetch();
    },
    syncFromChain,
  };
}
