// Position tracking from wallet Bet records (private, not public mappings)
//
// IMPORTANT: requestRecords() triggers a wallet approval popup every time.
// This hook must NEVER run automatically. Callers use refetch() explicitly
// after user-initiated actions (bet placed, claim, refund, modal open).
import { useCallback, useState } from "react";
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

/**
 * Returns user positions from wallet records.
 * Does NOT fetch automatically — call `refetch()` explicitly when needed.
 */
export function useUserPositions(marketIds: string[]) {
  const { publicKey, requestRecords } = useWallet();
  const [data, setData] = useState<OnChainPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!publicKey || !requestRecords || marketIds.length === 0) {
      setData([]);
      return;
    }

    setIsLoading(true);
    try {
      const rawRecords = await requestRecords(PROGRAM_ID);
      const positions = parseRecords(rawRecords as unknown[]);
      setData(positions.filter((p) => marketIds.includes(p.marketId)));
    } catch {
      // User rejected or wallet error — keep existing data
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, requestRecords, marketIds]);

  return { data, isLoading, refetch };
}
