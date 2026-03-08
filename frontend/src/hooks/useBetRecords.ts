// Fetch decrypted Bet records from the connected wallet
// Used at claim/refund time to get the private record needed for the transition
import { useCallback, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { PROGRAM_ID } from "../lib/aleo";

export interface BetRecord {
  owner: string;
  marketId: string;
  outcome: boolean;
  amount: bigint;
  // Raw record data for passing to transitions
  raw: string;
}

function parseRawRecord(raw: Record<string, unknown>): BetRecord | null {
  try {
    const data = raw as {
      owner?: string;
      market_id?: string;
      outcome?: string;
      amount?: string;
      _nonce?: string;
      spent?: boolean;
    };
    // Filter out spent (already consumed) records
    if (data.spent === true) return null;
    if (!data.market_id || !data.amount) return null;

    const marketId = String(data.market_id);
    const outcome = String(data.outcome) === "true";
    const amountStr = String(data.amount).replace(/u128$/, "").replace(/u64$/, "");
    const amount = BigInt(amountStr);

    return {
      owner: String(data.owner ?? ""),
      marketId,
      outcome,
      amount,
      raw: JSON.stringify(raw),
    };
  } catch {
    return null;
  }
}

/**
 * Hook for fetching and parsing private Bet records from the connected wallet.
 * Used at claim/refund time to obtain the encrypted record required by
 * `claim_winnings` and `claim_refund` transitions.
 */
export function useBetRecords() {
  const { requestRecords } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBetRecords = useCallback(
    async (marketId?: string): Promise<BetRecord[]> => {
      if (!requestRecords) {
        setError("Wallet does not support record requests");
        return [];
      }

      setLoading(true);
      setError(null);

      try {
        const rawRecords = await requestRecords(PROGRAM_ID);
        const parsed: BetRecord[] = [];

        for (const rec of rawRecords) {
          const record = parseRawRecord(rec as unknown as Record<string, unknown>);
          if (!record) continue;
          // Filter spent records (if the wallet marks them)
          if (marketId && record.marketId !== marketId) continue;
          parsed.push(record);
        }

        return parsed;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to fetch records";
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [requestRecords]
  );

  return { fetchBetRecords, loading, error };
}
