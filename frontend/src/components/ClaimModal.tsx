import { useState } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { calculatePayout, formatCredits, PROGRAM_ID } from "../lib/aleo";
import { useBetRecords } from "../hooks/useBetRecords";
import type { OnChainPosition } from "../hooks/useUserPositions";

interface ClaimModalProps {
  marketId: string;
  question: string;
  yesPool: bigint;
  noPool: bigint;
  winningOutcome: boolean;
  userPosition: OnChainPosition | null;
  isOpen: boolean;
  onClose: () => void;
  onClaimed?: () => void;
}

export function ClaimModal({
  marketId,
  question,
  yesPool,
  noPool,
  winningOutcome,
  userPosition,
  isOpen,
  onClose,
  onClaimed,
}: ClaimModalProps) {
  const { publicKey, requestTransaction, transactionStatus } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const { fetchBetRecords, loading: recordsLoading } = useBetRecords();
  const [recordError, setRecordError] = useState<string | null>(null);

  if (!isOpen) return null;

  const yesAmount = userPosition?.yesAmount ?? 0n;
  const noAmount = userPosition?.noAmount ?? 0n;
  const winningAmount = winningOutcome ? yesAmount : noAmount;
  const hasWinningPosition = winningAmount > 0n;

  const totalPayout = hasWinningPosition
    ? calculatePayout(winningAmount, yesPool, noPool, winningOutcome, winningOutcome)
    : 0n;

  const handleClaim = async () => {
    if (!publicKey || !requestTransaction || !hasWinningPosition) return;

    setRecordError(null);

    const records = await fetchBetRecords(marketId);
    const winningRecord = records.find((r) => r.outcome === winningOutcome);

    if (!winningRecord) {
      setRecordError(
        "No matching Bet record found in wallet. Ensure your wallet has the decrypted records from your bet transactions."
      );
      return;
    }

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "claim_winnings",
          [winningRecord.raw, `${totalPayout}u64`],
          500_000
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus }
    );

    if (resultTxId && onClaimed) {
      onClaimed();
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
          <h2 className="font-heading text-xl font-bold text-white">Claim Winnings</h2>
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

        {/* Outcome result */}
        <div
          className={`mb-4 p-3 rounded-xl text-center font-bold ${
            winningOutcome
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}
        >
          Result: {winningOutcome ? "YES" : "NO"} won
        </div>

        {/* Aggregated position summary */}
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Your Position</h3>
          {yesAmount > 0n && (
            <div
              className={`p-3 rounded-xl border ${
                winningOutcome
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className={winningOutcome ? "text-emerald-400" : "text-rose-400"}>
                  YES - {winningOutcome ? "Winner" : "Lost"}
                </span>
                <span className="text-gray-300">{formatCredits(yesAmount)} credits</span>
              </div>
            </div>
          )}
          {noAmount > 0n && (
            <div
              className={`p-3 rounded-xl border ${
                !winningOutcome
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className={!winningOutcome ? "text-emerald-400" : "text-rose-400"}>
                  NO - {!winningOutcome ? "Winner" : "Lost"}
                </span>
                <span className="text-gray-300">{formatCredits(noAmount)} credits</span>
              </div>
            </div>
          )}
          {!userPosition && (
            <div className="p-3 rounded-xl border border-navy-600 bg-navy-900/60 text-gray-400 text-center">
              No position found for this market.
            </div>
          )}
        </div>

        {/* Total payout */}
        {hasWinningPosition && (
          <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Total Payout:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {formatCredits(totalPayout)} credits
              </span>
            </div>
          </div>
        )}

        {!hasWinningPosition && userPosition && (
          <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 mb-4 text-center text-gray-400">
            No winning position to claim.
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
            Claiming requires your Bet record from the wallet. Ensure your
            wallet has the decrypted records from your bet transactions.
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
        {state === "idle" && hasWinningPosition && (
          <button
            onClick={handleClaim}
            disabled={recordsLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-white font-bold transition-colors"
          >
            {recordsLoading
              ? "Fetching records..."
              : `Claim ${formatCredits(totalPayout)} Credits`}
          </button>
        )}

        {state === "idle" && !hasWinningPosition && (
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

        {state === "failed" && hasWinningPosition && (
          <button
            onClick={handleClaim}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
