import { useState, useCallback } from "react";

// Transaction state machine states
export type TransactionState =
  | "idle"
  | "signing"
  | "proving"
  | "broadcasting"
  | "confirming"
  | "confirmed"
  | "failed";

// State messages for UI
export const stateMessages: Record<TransactionState, string> = {
  idle: "Place Bet",
  signing: "Approve in wallet...",
  proving: "Generating ZK proof (30-60s)...",
  broadcasting: "Broadcasting to network...",
  confirming: "Waiting for confirmation...",
  confirmed: "Success!",
  failed: "Failed - try again",
};

interface TransactionOptions {
  statusFn?: (txId: string) => Promise<string>;
}

interface UseTransactionResult {
  state: TransactionState;
  error: string | null;
  txId: string | null;
  elapsed: number;
  execute: (
    fn: () => Promise<string>,
    opts?: TransactionOptions
  ) => Promise<string | null>;
  reset: () => void;
}

export function useTransaction(): UseTransactionResult {
  const [state, setState] = useState<TransactionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setTxId(null);
    setElapsed(0);
  }, []);

  const execute = useCallback(
    async (
      fn: () => Promise<string>,
      opts?: TransactionOptions
    ): Promise<string | null> => {
      const { statusFn } = opts ?? {};
      setError(null);
      setTxId(null);
      setElapsed(0);

      // Start elapsed timer for proving phase
      let startTime = Date.now();
      const intervalId = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      try {
        // Signing phase
        setState("signing");
        await new Promise((r) => setTimeout(r, 100)); // Brief pause for UI update

        // Proving phase (this is where the heavy work happens)
        setState("proving");
        startTime = Date.now();

        const transactionId = await fn();
        setTxId(transactionId);

        // Broadcasting phase
        setState("broadcasting");
        await new Promise((r) => setTimeout(r, 500));

        // Confirming phase: wait for wallet to report completion
        setState("confirming");

        if (statusFn) {
          const maxAttempts = 60;
          const pollInterval = 5000;
          let walletDone = false;

          for (let i = 0; i < maxAttempts; i++) {
            try {
              const status = await statusFn(transactionId);
              console.log(`[tx-poll] attempt ${i + 1}: status="${status}"`);
              const s = status.toLowerCase();
              if (s === "finalized" || s === "completed" || s === "accepted") {
                walletDone = true;
                break;
              }
              if (s === "failed" || s === "rejected") {
                throw new Error(`Transaction ${s}`);
              }
            } catch (pollErr) {
              if (pollErr instanceof Error && (pollErr.message.startsWith("Transaction failed") || pollErr.message.startsWith("Transaction rejected"))) {
                throw pollErr;
              }
              console.log(`[tx-poll] attempt ${i + 1}: error`, pollErr);
            }
            await new Promise((r) => setTimeout(r, pollInterval));
          }

          if (!walletDone) {
            throw new Error("Transaction confirmation timed out");
          }
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }

        // Wallet reports done — transaction is signed, proved, and broadcast.
        // On-chain finalization happens in subsequent blocks; user can check explorer.
        setState("confirmed");
        clearInterval(intervalId);

        // Reset to idle after showing success
        setTimeout(() => {
          setState("idle");
        }, 5000);

        return transactionId;
      } catch (err) {
        setState("failed");
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        clearInterval(intervalId);

        // Allow retry after brief delay
        setTimeout(() => {
          setState("idle");
        }, 2000);

        return null;
      }
    },
    []
  );

  return {
    state,
    error,
    txId,
    elapsed,
    execute,
    reset,
  };
}
