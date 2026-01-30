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

        // Confirming phase - two steps:
        // 1. Wait for wallet to finish (sign, prove, broadcast)
        // 2. Verify on-chain via getExecution (wallet "Completed" != on-chain confirmed)
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
              if (s === "finalized") {
                // Truly on-chain confirmed — skip verification
                walletDone = true;
                break;
              }
              if (s === "completed" || s === "accepted") {
                // Wallet finished its part but tx may not be on-chain yet
                console.log("[tx-poll] wallet done, moving to on-chain verification");
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

        // On-chain verification: wallet "Completed" just means it was broadcast.
        // Poll getExecution to confirm the tx actually landed on-chain.
        if (getExecutionFn) {
          let onChainTxId: string | null = null;
          const verifyAttempts = 24; // 24 × 5s = 2 minutes
          const verifyInterval = 5000;

          for (let i = 0; i < verifyAttempts; i++) {
            await new Promise((r) => setTimeout(r, verifyInterval));
            try {
              const execution = await getExecutionFn(transactionId);
              console.log(`[tx-verify] attempt ${i + 1}:`, execution);
              if (typeof execution === "string" && execution.length > 0) {
                const match = execution.match(/at1[a-z0-9]+/);
                if (match) {
                  onChainTxId = match[0];
                }
                break;
              }
            } catch (err) {
              console.log(`[tx-verify] attempt ${i + 1}: not on-chain yet`);
            }
          }

          if (onChainTxId) {
            setTxId(onChainTxId);
          } else {
            throw new Error(
              "Transaction was broadcast but could not be verified on-chain. " +
              "It may still be processing — check the explorer."
            );
          }
        }

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
