/**
 * Modal for the reveal phase of commit-reveal betting.
 * Loads unrevealed commitments from IndexedDB and lets the user
 * reveal each one by submitting the `reveal_bet` transition with
 * the original direction, amount, and nonce.
 */
import { useState, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { formatCredits, PROGRAM_ID } from "../lib/aleo";
import { upsertUserPosition } from "../lib/supabase";
import {
  getUnrevealedCommitments,
  markRevealed,
  type StoredCommitment,
} from "../lib/commitmentStore";

interface RevealBetModalProps {
  marketId: string;
  question: string;
  isOpen: boolean;
  onClose: () => void;
  onRevealed?: () => void;
}

/**
 * Reveal phase modal: lists pending commitments from IndexedDB and submits
 * `reveal_bet` transactions for each one. On success, reports the position
 * to Supabase so it shows up without wallet popups.
 */
export function RevealBetModal({
  marketId,
  question,
  isOpen,
  onClose,
  onRevealed,
}: RevealBetModalProps) {
  const { address, executeTransaction, transactionStatus } = useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  const [commitments, setCommitments] = useState<StoredCommitment[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getUnrevealedCommitments(marketId)
      .then((c) => {
        setCommitments(c);
        setSelectedIdx(0);
      })
      .finally(() => setLoading(false));
  }, [isOpen, marketId]);

  if (!isOpen || !address || !transactionStatus) return null;

  const selected = commitments[selectedIdx] ?? null;

  const handleReveal = async () => {
    if (!executeTransaction || !selected) return;

    const resultTxId = await execute(
      async () => {
        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: "reveal_bet",
          inputs: [
            marketId,
            `${selected.direction}`,
            `${selected.amount}u64`,
            `${selected.nonce}field`,
          ],
          fee: 500_000,
        });
        return result?.transactionId ?? "";
      },
      { statusFn: (id: string) => transactionStatus(id).then((r) => r.status) }
    );

    if (resultTxId) {
      await markRevealed(marketId, selected.nonce);
      // Report position to Supabase
      upsertUserPosition(address, marketId, selected.direction, selected.amount).catch(() => {});
      setCommitments((prev) => prev.filter((_, i) => i !== selectedIdx));
      if (onRevealed) onRevealed();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isExecuting = state !== "idle" && state !== "confirmed" && state !== "failed";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-lg max-w-md w-full p-6 border-2 border-navy-600 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">Reveal Bet</h2>
          <button onClick={handleClose} disabled={isExecuting} className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
            ✕
          </button>
        </div>

        <p className="text-gray-300 mb-4 text-sm">{question}</p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="css-spinner-sm" />
          </div>
        ) : commitments.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm">No unrevealed commitments found for this market.</p>
            <button onClick={handleClose} className="mt-4 px-6 py-2 bg-navy-700 hover:bg-navy-600 rounded-xl text-white text-sm transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            {selected && state === "idle" && (
              <div className="mb-4 space-y-3">
                <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Direction:</span>
                    <span className={selected.direction ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {selected.direction ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white font-mono">{formatCredits(BigInt(selected.amount))} credits</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Committed:</span>
                    <span className="text-gray-300 text-xs">
                      {new Date(selected.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {commitments.length > 1 && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{selectedIdx + 1} of {commitments.length} commitments</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
                        disabled={selectedIdx === 0}
                        className="px-2 py-1 bg-navy-700 rounded disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setSelectedIdx(Math.min(commitments.length - 1, selectedIdx + 1))}
                        disabled={selectedIdx === commitments.length - 1}
                        className="px-2 py-1 bg-navy-700 rounded disabled:opacity-30"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleReveal}
                  className="w-full py-3 btn-primary rounded-xl font-bold"
                >
                  Reveal Bet
                </button>
              </div>
            )}

            <TransactionProgress state={state} elapsed={elapsed} txId={txId} error={error} />

            {state === "confirmed" && (
              <button onClick={handleClose} className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-colors">
                Done
              </button>
            )}

            {state === "failed" && (
              <button onClick={handleReveal} className="w-full mt-3 py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold transition-colors">
                Try Again
              </button>
            )}

            {isExecuting && (
              <button disabled className="w-full mt-3 py-3 bg-navy-700 rounded-xl text-white font-bold flex items-center justify-center gap-2">
                <span className="css-spinner-sm" />
                {stateMessages[state]}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
