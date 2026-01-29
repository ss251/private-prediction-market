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
  getExecutionFn?: (txId: string) => Promise<string>;
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
      const { statusFn, getExecutionFn } = opts ?? {};
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

        // Confirming phase - poll via wallet adapter's transactionStatus
        setState("confirming");

        if (statusFn) {
          // Use wallet adapter's transactionStatus for deterministic tracking
          const maxAttempts = 60;
          const pollInterval = 5000;
          let confirmed = false;

          for (let i = 0; i < maxAttempts; i++) {
            try {
              const status = await statusFn(transactionId);
              console.log(`[tx-poll] attempt ${i + 1}: status="${status}"`);
              const s = status.toLowerCase();
              if (s === "finalized" || s === "completed" || s === "accepted") {
                confirmed = true;
                break;
              }
              if (s === "failed" || s === "rejected") {
                throw new Error(`Transaction ${s}`);
              }
            } catch (pollErr) {
              // Re-throw if it's our own error (failed/rejected)
              if (pollErr instanceof Error && (pollErr.message.startsWith("Transaction failed") || pollErr.message.startsWith("Transaction rejected"))) {
                throw pollErr;
              }
              console.log(`[tx-poll] attempt ${i + 1}: error`, pollErr);
              // Otherwise wallet call failed - continue polling
            }
            await new Promise((r) => setTimeout(r, pollInterval));
          }

          if (!confirmed) {
            throw new Error("Transaction confirmation timed out");
          }
        } else {
          // No status function provided - brief wait then assume success
          await new Promise((r) => setTimeout(r, 2000));
        }

        setState("confirmed");
        clearInterval(intervalId);

        // Resolve the real on-chain at1... tx ID in the background
        // so the UI shows "confirmed" immediately while we fetch it
        if (getExecutionFn) {
          (async () => {
            for (let attempt = 0; attempt < 5; attempt++) {
              await new Promise((r) => setTimeout(r, 3000));
              try {
                const execution = await getExecutionFn(transactionId);
                console.log(`[tx-resolve] attempt ${attempt + 1}:`, execution);
                if (typeof execution === "string") {
                  const match = execution.match(/at1[a-z0-9]+/);
                  if (match) {
                    setTxId(match[0]);
                    return;
                  }
                }
              } catch (execErr) {
                console.log(`[tx-resolve] attempt ${attempt + 1}: error`, execErr);
              }
            }
          })();
        }

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
