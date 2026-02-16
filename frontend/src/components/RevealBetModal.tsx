/**
 * Modal for the reveal phase of commit-reveal betting.
 * Reads pending commitments from localStorage and submits the preimage
 * (direction, amount, nonce) to prove the commitment and update pools.
 */
import { useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { PROGRAM_ID, formatCredits } from "../lib/aleo";
import {
  getPendingCommitments,
  updateCommitmentStatus,
  type PendingCommitment,
} from "../lib/commitReveal";
import { saveLocalPosition } from "../lib/localPositions";

interface RevealBetModalProps {
  marketId: string;
  question: string;
  isOpen: boolean;
  onClose: () => void;
  onRevealed?: () => void;
}

/** Modal component for revealing previously committed bets. */
export function RevealBetModal({
  marketId,
  question,
  isOpen,
  onClose,
  onRevealed,
}: RevealBetModalProps) {
  const { address, executeTransaction, transactionStatus } = useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  if (!isOpen || !transactionStatus) return null;

  const pending = getPendingCommitments(marketId);

  const handleReveal = async (
    commitment: PendingCommitment,
    index: number
  ) => {
    if (!address || !executeTransaction) return;

    setRevealedIndex(index);

    const resultTxId = await execute(
      async () => {
        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: "reveal_bet",
          inputs: [
            commitment.marketId,
            `${commitment.direction}`,
            `${commitment.amount}u64`,
            commitment.nonce,
          ],
          fee: 500_000,
          privateFee: false,
        });
        return result?.transactionId ?? "";
      },
      {
        statusFn: (id: string) =>
          transactionStatus(id).then((r) => r.status),
      }
    );

    if (resultTxId) {
      updateCommitmentStatus(commitment.nonce, "revealed");
      saveLocalPosition({
        marketId: commitment.marketId,
        outcome: commitment.direction,
        amount: commitment.amount,
        txId: resultTxId,
        timestamp: Date.now(),
      });
      if (onRevealed) onRevealed();
    }
  };

  const handleClose = () => {
    reset();
    setRevealedIndex(null);
    onClose();
  };

  const isExecuting =
    state !== "idle" && state !== "confirmed" && state !== "failed";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-lg max-w-md w-full p-6 border-2 border-navy-600 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">
            Reveal Bets
          </h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 mb-4">{question}</p>

        {pending.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>No pending commitments for this market.</p>
            <p className="text-xs mt-2">
              Commitments may have already been revealed, or were made in
              another browser.
            </p>
          </div>
        )}

        {pending.map((commitment, i) => (
          <div
            key={commitment.nonce}
            className="mb-3 p-4 rounded-xl border border-navy-600 bg-navy-900/60"
          >
            <div className="flex justify-between text-sm mb-2">
              <span
                className={
                  commitment.direction ? "text-emerald-400" : "text-rose-400"
                }
              >
                {commitment.direction ? "YES" : "NO"}
              </span>
              <span className="text-gray-300 font-mono">
                {formatCredits(BigInt(commitment.amount))} credits
              </span>
            </div>
            <div className="text-xs text-gray-600 mb-3 font-mono truncate">
              Nonce: {commitment.nonce.slice(0, 20)}...
            </div>

            {revealedIndex === i && (
              <TransactionProgress
                state={state}
                elapsed={elapsed}
                txId={txId}
                error={error}
              />
            )}

            {(revealedIndex !== i || state === "idle") && (
              <button
                onClick={() => handleReveal(commitment, i)}
                disabled={isExecuting}
                className="w-full py-2 bg-accent/10 text-accent border border-accent/20 hover:border-accent/40 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                Reveal This Bet
              </button>
            )}
          </div>
        ))}

        {state === "confirmed" && (
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-colors mt-3"
          >
            Done
          </button>
        )}

        {isExecuting && (
          <button
            type="button"
            disabled
            className="w-full py-3 bg-navy-700 rounded-xl text-white font-bold flex items-center justify-center gap-2 mt-3"
          >
            <span className="css-spinner-sm" />
            {stateMessages[state]}
          </button>
        )}

        {pending.length === 0 && (
          <button
            onClick={handleClose}
            className="w-full py-3 bg-navy-700 hover:bg-navy-600 rounded-xl text-white font-bold transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
