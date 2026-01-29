// On-chain position tracking per market for the connected wallet
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { getMappingValue } from "../lib/aleo";
import { getUserPosition, computeUserKey } from "../lib/marketIndex";

export interface OnChainPosition {
  marketId: string;
  yesAmount: bigint;
  noAmount: bigint;
  claimed: boolean;
}

async function fetchPositionForMarket(
  marketId: string,
  address: string
): Promise<OnChainPosition | null> {
  const position = await getUserPosition(marketId, address);
  if (!position) return null;

  // Check claimed status
  const userKey = await computeUserKey(marketId, address);
  const key = userKey.endsWith("field") ? userKey : `${userKey}field`;
  const claimedRaw = await getMappingValue("claimed", key);
  const claimed = claimedRaw === "true";

  return {
    marketId,
    yesAmount: position.yesAmount,
    noAmount: position.noAmount,
    claimed,
  };
}

export function useUserPositions(marketIds: string[]) {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["userPositions", publicKey, marketIds],
    queryFn: async (): Promise<OnChainPosition[]> => {
      if (!publicKey || marketIds.length === 0) return [];

      const results = await Promise.all(
        marketIds.map((id) => fetchPositionForMarket(id, publicKey))
      );
      return results.filter((p): p is OnChainPosition => p !== null);
    },
    enabled: !!publicKey && marketIds.length > 0,
    refetchInterval: 30_000,
  });
}
