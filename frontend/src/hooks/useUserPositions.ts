// Position tracking from wallet Bet records (private, not public mappings)
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { PROGRAM_ID } from "../lib/aleo";

export interface OnChainPosition {
  marketId: string;
  yesAmount: bigint;
  noAmount: bigint;
}

interface RawRecord {
  owner?: string;
  market_id?: string;
  outcome?: string;
  amount?: string;
  _nonce?: string;
}

function parseRecords(rawRecords: unknown[]): OnChainPosition[] {
  const byMarket = new Map<string, { yes: bigint; no: bigint }>();

  for (const rec of rawRecords) {
    try {
      const data = rec as RawRecord;
      if (!data.market_id || !data.amount) continue;

      const marketId = String(data.market_id);
      const outcome = String(data.outcome) === "true";
      const amountStr = String(data.amount).replace(/u64$/, "");
      const amount = BigInt(amountStr);

      const existing = byMarket.get(marketId) ?? { yes: 0n, no: 0n };
      if (outcome) {
        existing.yes += amount;
      } else {
        existing.no += amount;
      }
      byMarket.set(marketId, existing);
    } catch {
      continue;
    }
  }

  return Array.from(byMarket.entries()).map(([marketId, amounts]) => ({
    marketId,
    yesAmount: amounts.yes,
    noAmount: amounts.no,
  }));
}

export function useUserPositions(marketIds: string[]) {
  const { publicKey, requestRecords } = useWallet();

  return useQuery({
    queryKey: ["userPositions", publicKey, marketIds],
    queryFn: async (): Promise<OnChainPosition[]> => {
      if (!publicKey || !requestRecords || marketIds.length === 0) return [];

      const rawRecords = await requestRecords(PROGRAM_ID);
      const positions = parseRecords(rawRecords as unknown[]);

      // Only return positions for requested markets
      return positions.filter((p) => marketIds.includes(p.marketId));
    },
    enabled: !!publicKey && !!requestRecords && marketIds.length > 0,
    refetchInterval: 30_000,
  });
}
