import { useState } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { PROGRAM_ID, formatCredits } from "../lib/aleo";

interface ResolveModalProps {
  marketId: string;
  question: string;
  yesPool: bigint;
  noPool: bigint;
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

export function ResolveModal({
  marketId,
  question,
  yesPool,
  noPool,
  isOpen,
  onClose,
  onResolved,
}: ResolveModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  const [outcome, setOutcome] = useState<boolean>(true);

  if (!isOpen) return null;

  const totalPool = yesPool + noPool;

  const handleResolve = async () => {
    if (!publicKey || !requestTransaction) return;

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "resolve_market",
          [marketId, `${outcome}`],
          500_000
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
    );

    if (resultTxId && onResolved) {
      onResolved();
    }
  };

  const handleClose = () => {
    reset();
    setOutcome(true);
    onClose();
  };

  const isExecuting =
    state !== "idle" && state !== "confirmed" && state !== "failed";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">Resolve Market</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            &#10005;
          </button>
        </div>

        <p className="text-gray-300 mb-4">{question}</p>

        {/* Market info */}
        <div className="bg-gray-700/50 rounded-lg p-3 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Pool:</span>
            <span className="text-white font-mono">
              {formatCredits(totalPool)} credits
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">YES Pool:</span>
            <span className="text-green-400 font-mono">
              {formatCredits(yesPool)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">NO Pool:</span>
            <span className="text-red-400 font-mono">
              {formatCredits(noPool)}
            </span>
          </div>
        </div>

        {/* Outcome selection */}
        {state === "idle" && (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-gray-400">
              Select the winning outcome for this market.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOutcome(true)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors ${
                  outcome
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
              >
                YES wins
              </button>
              <button
                type="button"
                onClick={() => setOutcome(false)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors ${
                  !outcome
                    ? "bg-red-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
              >
                NO wins
              </button>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <span>&#9432;</span>
          <span>
            Only the contract admin can resolve markets. This calls
            resolve_market on-chain. Winning bettors can then claim their
            payouts.
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
        {state === "idle" && (
          <button
            onClick={handleResolve}
            className={`w-full py-3 rounded-lg text-white font-bold transition-colors ${
              outcome
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            Resolve as {outcome ? "YES" : "NO"}
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

        {state === "failed" && (
          <button
            onClick={handleResolve}
            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
