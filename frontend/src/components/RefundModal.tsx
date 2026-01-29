import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { formatCredits } from "../lib/aleo";
import type { StoredBet } from "../hooks/useBets";

interface RefundModalProps {
  marketId: string;
  question: string;
  bets: StoredBet[];
  isOpen: boolean;
  onClose: () => void;
  onRefunded?: (txId: string) => void;
}

const PROGRAM_ID = "prediction_market_test001.aleo";

export function RefundModal({
  marketId,
  question,
  bets,
  isOpen,
  onClose,
  onRefunded,
}: RefundModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } = useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  if (!isOpen) return null;

  const totalRefund = bets.reduce((sum, b) => sum + BigInt(b.amount), 0n);

  const handleRefund = async () => {
    if (!publicKey || !requestTransaction || bets.length === 0) return;

    // Submit refund for the first unclaimed bet
    // In practice, each bet record would need its own claim_refund call
    const bet = bets[0];

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "claim_refund",
          [
            // The Bet record would be passed from the wallet's decrypted records
          ],
          500_000 // fee for refund tx
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
    );

    if (resultTxId && onRefunded) {
      onRefunded(resultTxId);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isExecuting = state !== "idle" && state !== "confirmed" && state !== "failed";

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

        {/* Bet summary */}
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Your Bets</h3>
          {bets.map((bet) => (
            <div
              key={bet.txId}
              className="p-3 rounded-lg border border-gray-600 bg-gray-700/30"
            >
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">
                  {bet.outcome ? "YES" : "NO"} bet
                </span>
                <span className="text-gray-300">
                  {formatCredits(BigInt(bet.amount))} credits
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Refund total */}
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

        {/* Note about record requirement */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <span>&#9432;</span>
          <span>
            Refunding requires your Bet record from the wallet. Each bet needs
            a separate refund transaction.
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
        {state === "idle" && bets.length > 0 && (
          <button
            onClick={handleRefund}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition-colors"
          >
            Claim Refund ({formatCredits(totalRefund)} credits)
          </button>
        )}

        {state === "idle" && bets.length === 0 && (
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

        {state === "failed" && bets.length > 0 && (
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
