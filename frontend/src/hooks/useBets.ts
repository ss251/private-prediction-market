import { useState, useCallback, useEffect } from "react";

// Stored bet data (persisted to localStorage)
export interface StoredBet {
  marketId: string;
  outcome: boolean; // true = YES, false = NO
  amount: number; // microcredits
  txId: string;
  timestamp: number;
  claimed: boolean;
}

const STORAGE_KEY = "prediction_market_bets";

function loadBets(): StoredBet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveBets(bets: StoredBet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

export function useBets(publicKey: string | null) {
  const [bets, setBets] = useState<StoredBet[]>([]);

  // Load bets on mount and when publicKey changes
  useEffect(() => {
    if (!publicKey) {
      setBets([]);
      return;
    }
    // Bets are keyed by wallet address
    const key = `${STORAGE_KEY}_${publicKey}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setBets(JSON.parse(raw));
      } else {
        setBets([]);
      }
    } catch {
      setBets([]);
    }
  }, [publicKey]);

  // Persist whenever bets change
  useEffect(() => {
    if (!publicKey) return;
    const key = `${STORAGE_KEY}_${publicKey}`;
    saveBets(bets);
    localStorage.setItem(key, JSON.stringify(bets));
  }, [bets, publicKey]);

  // Add a new bet after successful transaction
  const addBet = useCallback(
    (marketId: string, outcome: boolean, amount: number, txId: string) => {
      setBets((prev) => [
        ...prev,
        {
          marketId,
          outcome,
          amount,
          txId,
          timestamp: Date.now(),
          claimed: false,
        },
      ]);
    },
    []
  );

  // Mark a bet as claimed
  const markClaimed = useCallback((txId: string) => {
    setBets((prev) =>
      prev.map((b) => (b.txId === txId ? { ...b, claimed: true } : b))
    );
  }, []);

  // Get bets for a specific market
  const getBetsForMarket = useCallback(
    (marketId: string) => {
      return bets.filter((b) => b.marketId === marketId);
    },
    [bets]
  );

  // Get unclaimed bets for a specific market
  const getUnclaimedBets = useCallback(
    (marketId: string) => {
      return bets.filter((b) => b.marketId === marketId && !b.claimed);
    },
    [bets]
  );

  // Update a bet's txId (e.g. when the on-chain at1... ID is resolved)
  const updateTxId = useCallback((oldTxId: string, newTxId: string) => {
    setBets((prev) =>
      prev.map((b) => (b.txId === oldTxId ? { ...b, txId: newTxId } : b))
    );
  }, []);

  // Get total bet amount for a market/outcome
  const getTotalBet = useCallback(
    (marketId: string, outcome?: boolean) => {
      return bets
        .filter(
          (b) =>
            b.marketId === marketId &&
            (outcome === undefined || b.outcome === outcome)
        )
        .reduce((sum, b) => sum + b.amount, 0);
    },
    [bets]
  );

  return {
    bets,
    addBet,
    markClaimed,
    updateTxId,
    getBetsForMarket,
    getUnclaimedBets,
    getTotalBet,
  };
}
