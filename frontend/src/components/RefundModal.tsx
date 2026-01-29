import { useState } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
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

export function RefundModal({
  marketId,
  question,
  userPosition,
  isOpen,
  onClose,
  onRefunded,
}: RefundModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const { fetchBetRecords, loading: recordsLoading } = useBetRecords();
  const [recordError, setRecordError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Already claimed/refunded check
  if (userPosition?.claimed) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-white">Claim Refund</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              &#10005;
            </button>
          </div>
          <p className="text-gray-300 mb-4">{question}</p>
          <div className="bg-gray-700/50 rounded-lg p-4 text-center text-gray-400 mb-4">
            You have already claimed your refund for this market.
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const yesAmount = userPosition?.yesAmount ?? 0n;
  const noAmount = userPosition?.noAmount ?? 0n;
  const totalRefund = yesAmount + noAmount;
  const hasPosition = totalRefund > 0n;

  const handleRefund = async () => {
    if (!publicKey || !requestTransaction || !hasPosition) return;

    setRecordError(null);

    // Fetch Bet records from wallet
    const records = await fetchBetRecords(marketId);

    if (records.length === 0) {
      setRecordError(
        "No Bet records found in wallet. Ensure your wallet has the decrypted records from your bet transactions."
      );
      return;
    }

    // Use first available record for refund
    const record = records[0];

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "claim_refund",
          [record.raw],
          500_000
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">Claim Refund</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            &#10005;
          </button>
        </div>

        <p className="text-gray-300 mb-4">{question}</p>

        {/* Cancelled notice */}
        <div className="mb-4 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700 text-yellow-400 text-center font-medium">
          This market has been cancelled
        </div>

        {/* Position summary */}
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Your Position</h3>
          {yesAmount > 0n && (
            <div className="p-3 rounded-lg border border-gray-600 bg-gray-700/30">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">YES bet</span>
                <span className="text-gray-300">
                  {formatCredits(yesAmount)} credits
                </span>
              </div>
            </div>
          )}
          {noAmount > 0n && (
            <div className="p-3 rounded-lg border border-gray-600 bg-gray-700/30">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">NO bet</span>
                <span className="text-gray-300">
                  {formatCredits(noAmount)} credits
                </span>
              </div>
            </div>
          )}
          {!hasPosition && (
            <div className="p-3 rounded-lg border border-gray-600 bg-gray-700/30 text-gray-400 text-center">
              No position found for this market.
            </div>
          )}
        </div>

        {/* Refund total */}
        {hasPosition && (
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Total Refund:</span>
              <span className="text-blue-400 font-bold font-mono">
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
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
            {recordError}
          </div>
        )}

        {/* Note about record requirement */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <span>&#9432;</span>
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white font-bold transition-colors"
          >
            {recordsLoading
              ? "Fetching records..."
              : `Claim Refund (${formatCredits(totalRefund)} credits)`}
          </button>
        )}

        {state === "idle" && !hasPosition && (
          <button
            onClick={handleClose}
            className="w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-bold transition-colors"
          >
            Close
          </button>
        )}

        {state === "confirmed" && (
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-colors"
          >
            Done
          </button>
        )}

        {isExecuting && (
          <button
            type="button"
            disabled
            className="w-full py-3 bg-gray-600 rounded-lg text-white font-bold flex items-center justify-center gap-2"
          >
            <span className="animate-spin">&#8987;</span>
            {stateMessages[state]}
          </button>
        )}

        {state === "failed" && hasPosition && (
          <button
            onClick={handleRefund}
            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
