// Hook for market history using on-chain data

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { getMarketData, PROGRAM_ID, type MarketData } from "../lib/aleo";

/** A user's aggregated bet position in a single market. */
export interface UserPosition {
  yesAmount: bigint;
  noAmount: bigint;
}

/** Combined market chain data and user position returned by useMarketHistory. */
export interface MarketHistoryData {
  userPosition: UserPosition | null;
  marketData: MarketData | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches on-chain market data and the connected user's bet position.
 * Re-fetches when the market ID or wallet address changes.
 */
export function useMarketHistory(
  marketId: string,
  userAddress: string | null,
  enabled: boolean = true,
  initialMarketData?: MarketData | null,
): MarketHistoryData {
  const { requestRecords } = useWallet();

  // Fetch current market state (skip if we already have data)
  const {
    data: marketData,
    isLoading: isMarketLoading,
    error: marketError,
  } = useQuery({
    queryKey: ["marketHistory", marketId],
    queryFn: () => getMarketData(marketId),
    enabled: enabled && !initialMarketData,
    initialData: initialMarketData ?? undefined,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Derive user position from wallet records
  const {
    data: userPosition,
    isLoading: isPositionLoading,
  } = useQuery({
    queryKey: ["marketHistoryPosition", marketId, userAddress],
    queryFn: async (): Promise<UserPosition | null> => {
      if (!userAddress || !requestRecords) return null;

      try {
        const rawRecords = await requestRecords(PROGRAM_ID);
        let yesAmount = 0n;
        let noAmount = 0n;

        for (const rec of rawRecords as unknown[]) {
          const data = rec as { market_id?: string; outcome?: string; amount?: string };
          if (!data.market_id || !data.amount) continue;
          // Normalize: record may have "3field" while marketId may be "3field" or "3"
          const recordMarketId = String(data.market_id).replace(/field$/, "");
          const normalizedMarketId = marketId.replace(/field$/, "");
          if (recordMarketId !== normalizedMarketId) continue;

          const outcome = String(data.outcome) === "true";
          const amount = BigInt(String(data.amount).replace(/u128$/, "").replace(/u64$/, ""));

          if (outcome) {
            yesAmount += amount;
          } else {
            noAmount += amount;
          }
        }

        if (yesAmount === 0n && noAmount === 0n) return null;
        return { yesAmount, noAmount };
      } catch {
        return null;
      }
    },
    enabled: enabled && !!userAddress && !!requestRecords,
    // Never auto-refetch: requestRecords triggers a wallet popup each time.
    // But retry once when wallet becomes available (address changes).
    refetchInterval: false,
    staleTime: 5 * 60_000,
  });

  return {
    userPosition: userPosition ?? null,
    marketData: marketData ?? null,
    isLoading: isMarketLoading || isPositionLoading,
    error: marketError as Error | null,
  };
}
