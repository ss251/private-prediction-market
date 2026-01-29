// Hook for market history using on-chain data

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarketData, type MarketData } from "../lib/aleo";
import { getMarketBettors, type BettorEntry } from "../lib/marketIndex";

export interface UserPosition {
  yesAmount: bigint;
  noAmount: bigint;
}

export interface MarketHistoryData {
  bettors: BettorEntry[];
  userPosition: UserPosition | null;
  marketData: MarketData | null;
  isLoading: boolean;
  isBettorsLoading: boolean;
  error: Error | null;
}

export function useMarketHistory(
  marketId: string,
  userAddress: string | null,
  enabled: boolean = true
): MarketHistoryData {
  // Fetch current market state
  const {
    data: marketData,
    isLoading: isMarketLoading,
    error: marketError,
  } = useQuery({
    queryKey: ["marketHistory", marketId],
    queryFn: () => getMarketData(marketId),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Fetch on-chain bettor ledger
  const {
    data: bettors,
    isLoading: isBettorsLoading,
    error: bettorsError,
  } = useQuery({
    queryKey: ["marketBettors", marketId],
    queryFn: () => getMarketBettors(marketId),
    enabled,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // Derive user position from bettors array (no extra query needed)
  const userPosition = useMemo(() => {
    if (!userAddress || !bettors) return null;
    const entry = bettors.find((b) => b.address === userAddress);
    if (!entry) return null;
    return { yesAmount: entry.yesAmount, noAmount: entry.noAmount };
  }, [bettors, userAddress]);

  return {
    bettors: bettors ?? [],
    userPosition,
    marketData: marketData ?? null,
    isLoading: isMarketLoading,
    isBettorsLoading,
    error: (marketError ?? bettorsError) as Error | null,
  };
}
