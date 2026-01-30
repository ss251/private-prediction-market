// Hook for market history using on-chain data

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { getMarketData, PROGRAM_ID, type MarketData } from "../lib/aleo";

export interface UserPosition {
  yesAmount: bigint;
  noAmount: bigint;
}

export interface MarketHistoryData {
  userPosition: UserPosition | null;
  marketData: MarketData | null;
  isLoading: boolean;
  error: Error | null;
}

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
          if (String(data.market_id) !== marketId) continue;

          const outcome = String(data.outcome) === "true";
          const amount = BigInt(String(data.amount).replace(/u64$/, ""));

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
    refetchInterval: 30_000,
  });

  return {
    userPosition: userPosition ?? null,
    marketData: marketData ?? null,
    isLoading: isMarketLoading || isPositionLoading,
    error: marketError as Error | null,
  };
}
