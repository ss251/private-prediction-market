import { useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { formatCredits, PROGRAM_ID } from "../lib/aleo";
import { useBetRecords } from "../hooks/useBetRecords";
import type { OnChainPosition } from "../hooks/useUserPositions";

interface RefundModalProps {
  marketId: string;
  question: string;
  userPosition: OnChainPosition | null;
  isOpen: boolean;
  onClose: () => void;
  onRefunded?: () => void;
}

/**
 * Modal for claiming refunds on cancelled markets.
 * Fetches the user's private Bet record from the wallet and submits a
 * `claim_refund` transaction to return the full bet amount (no fees).
 */
export function RefundModal({
  marketId,
  question,
  userPosition,
  isOpen,
  onClose,
  onRefunded,
}: RefundModalProps) {
  const { address, executeTransaction, transactionStatus } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const { fetchBetRecords, loading: recordsLoading } = useBetRecords();
  const [recordError, setRecordError] = useState<string | null>(null);

  if (!isOpen || !address || !transactionStatus) return null;

  const yesAmount = userPosition?.yesAmount ?? 0n;
  const noAmount = userPosition?.noAmount ?? 0n;
  const totalRefund = yesAmount + noAmount;
  const hasPosition = totalRefund > 0n;

  const handleRefund = async () => {
    if (!address || !executeTransaction || !hasPosition) return;

    setRecordError(null);

    const records = await fetchBetRecords(marketId);

    if (records.length === 0) {
      setRecordError(
        "No Bet records found in wallet. Ensure your wallet has the decrypted records from your bet transactions."
      );
      return;
    }

    const record = records[0];

    const resultTxId = await execute(
      async () => {
        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: "claim_refund",
          inputs: [record.raw],
          fee: 500_000,
        });
        return result?.transactionId ?? "";
      },
      { statusFn: (txId: string) => transactionStatus(txId).then(r => r.status) }
    );

    if (resultTxId && onRefunded) {
      onRefunded();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isExecuting =
    state !== "idle" && state !== "confirmed" && state !== "failed";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-lg max-w-md w-full p-6 border-2 border-navy-600 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">Claim Refund</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="text-gray-300 mb-4">{question}</p>

        {/* Cancelled notice */}
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center font-medium">
          This market has been cancelled
        </div>

        {/* Position summary */}
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Your Position</h3>
          {yesAmount > 0n && (
            <div className="p-3 rounded-xl border border-navy-600 bg-navy-900/60">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">YES bet</span>
                <span className="text-gray-300">{formatCredits(yesAmount)} credits</span>
              </div>
            </div>
          )}
          {noAmount > 0n && (
            <div className="p-3 rounded-xl border border-navy-600 bg-navy-900/60">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">NO bet</span>
                <span className="text-gray-300">{formatCredits(noAmount)} credits</span>
              </div>
            </div>
          )}
          {!hasPosition && (
            <div className="p-3 rounded-xl border border-navy-600 bg-navy-900/60 text-gray-400 text-center">
              No position found for this market.
            </div>
          )}
        </div>

        {/* Refund total */}
        {hasPosition && (
          <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Total Refund:</span>
              <span className="text-accent-light font-bold font-mono">
                {formatCredits(totalRefund)} credits
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Full refund - no fees deducted for cancelled markets
            </p>
          </div>
        )}

        {/* Record error */}
        {recordError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
            {recordError}
          </div>
        )}

        {/* Note about record requirement */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            Refunding requires your Bet record from the wallet. Each bet needs a
            separate refund transaction.
          </span>
        </div>

        {/* Transaction progress */}
        <TransactionProgress
          state={state}
          elapsed={elapsed}
          txId={txId}
          error={error}
        />

        {/* Action buttons */}
        {state === "idle" && hasPosition && (
          <button
            onClick={handleRefund}
            disabled={recordsLoading}
            className="w-full py-3 btn-primary rounded-xl font-bold"
          >
            {recordsLoading
              ? "Fetching records..."
              : `Claim Refund (${formatCredits(totalRefund)} credits)`}
          </button>
        )}

        {state === "idle" && !hasPosition && (
          <button
            onClick={handleClose}
            className="w-full py-3 bg-navy-700 hover:bg-navy-600 rounded-xl text-white font-bold transition-colors"
          >
            Close
          </button>
        )}

        {state === "confirmed" && (
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-colors"
          >
            Done
          </button>
        )}

        {isExecuting && (
          <button
            type="button"
            disabled
            className="w-full py-3 bg-navy-700 rounded-xl text-white font-bold flex items-center justify-center gap-2"
          >
            <span className="css-spinner-sm" />
            {stateMessages[state]}
          </button>
        )}

        {state === "failed" && hasPosition && (
          <button
            onClick={handleRefund}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
