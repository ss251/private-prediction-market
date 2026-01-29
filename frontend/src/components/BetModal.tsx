import { useState, useEffect } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { getPublicBalance, formatCredits, PROGRAM_ID } from "../lib/aleo";

interface Market {
  id: string;
  question: string;
  yesPool: number;
  noPool: number;
  paused?: boolean;
}

interface BetModalProps {
  market: Market;
  isOpen: boolean;
  onClose: () => void;
  onBetPlaced?: () => void;
}

export function BetModal({ market, isOpen, onClose, onBetPlaced }: BetModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } = useWallet();
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  // Fetch balance when modal opens
  useEffect(() => {
    if (!isOpen || !publicKey) {
      setBalance(null);
      return;
    }
    setBalanceLoading(true);
    getPublicBalance(publicKey)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [isOpen, publicKey]);

  if (!isOpen) return null;

  const amountMicrocredits = amount ? Math.floor(parseFloat(amount) * 1_000_000) : 0;
  const insufficientBalance = balance !== null && amountMicrocredits > 0 && BigInt(amountMicrocredits) > balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !requestTransaction) return;

    if (amountMicrocredits < 1000) {
      return; // Minimum bet validation
    }

    const resultTxId = await execute(
      async () => {
        // Create the transaction using wallet adapter
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "place_bet",
          [
            market.id, // market_id: field
            outcome === "yes" ? "true" : "false", // outcome: bool (private)
            `${amountMicrocredits}u64`, // amount: u64
          ],
          500_000, // fee (gas) in microcredits - separate from bet amount
          false // feePrivate: false = use public credits for fee
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
    );

    // Signal that a bet was placed (triggers position refetch)
    if (resultTxId && onBetPlaced) {
      onBetPlaced();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const totalPool = market.yesPool + market.noPool;
  const selectedPool = outcome === "yes" ? market.yesPool : market.noPool;

  // Calculate odds (potential return multiplier)
  const currentOdds =
    totalPool > 0 && selectedPool > 0
      ? ((totalPool / selectedPool) * 0.98).toFixed(2) // 2% fee
      : "2.00";

  const isExecuting = state !== "idle" && state !== "confirmed" && state !== "failed";
  const canSubmit = !isExecuting && amount && parseFloat(amount) >= 0.001 && !insufficientBalance && !market.paused;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">Place Your Bet</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            &#10005;
          </button>
        </div>

        <p className="text-gray-300 mb-6">{market.question}</p>

        {market.paused && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-400 text-sm">
            This market is currently paused. Betting is temporarily disabled.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Outcome selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setOutcome("yes")}
              disabled={isExecuting}
              className={`p-4 rounded-lg border-2 transition-colors ${
                outcome === "yes"
                  ? "border-green-500 bg-green-500/20 text-green-400"
                  : "border-gray-600 text-gray-400 hover:border-gray-500"
              } disabled:opacity-50`}
            >
              <div className="text-2xl mb-1">&#128077;</div>
              <div className="font-bold">YES</div>
            </button>
            <button
              type="button"
              onClick={() => setOutcome("no")}
              disabled={isExecuting}
              className={`p-4 rounded-lg border-2 transition-colors ${
                outcome === "no"
                  ? "border-red-500 bg-red-500/20 text-red-400"
                  : "border-gray-600 text-gray-400 hover:border-gray-500"
              } disabled:opacity-50`}
            >
              <div className="text-2xl mb-1">&#128078;</div>
              <div className="font-bold">NO</div>
            </button>
          </div>

          {/* Amount input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Amount (Credits)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.01"
              step="0.001"
              min="0.001"
              disabled={isExecuting}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              required
            />
            {/* Balance display */}
            <div className="mt-2 flex justify-between items-center text-sm">
              <span className="text-gray-500">
                {balanceLoading
                  ? "Loading balance..."
                  : balance !== null
                    ? `Available: ${formatCredits(balance)} credits`
                    : "Connect wallet to see balance"}
              </span>
              {balance !== null && balance > 0n && (
                <button
                  type="button"
                  onClick={() => setAmount((Number(balance) / 1_000_000).toString())}
                  className="text-blue-400 hover:text-blue-300 text-xs"
                  disabled={isExecuting}
                >
                  Max
                </button>
              )}
            </div>
            {insufficientBalance && (
              <p className="mt-1 text-sm text-red-400">
                Insufficient balance for this bet
              </p>
            )}
          </div>

          {/* Odds display */}
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current Odds:</span>
              <span className="text-white font-mono">{currentOdds}x</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Potential Win:</span>
              <span className="text-green-400 font-mono">
                {amount
                  ? (parseFloat(amount) * parseFloat(currentOdds)).toFixed(4)
                  : "0.00"}{" "}
                credits
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Pool Size:</span>
              <span className="text-gray-300 font-mono">
                {(totalPool / 1_000_000).toFixed(2)} credits
              </span>
            </div>
          </div>

          {/* Privacy notice */}
          <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
            <span>&#128274;</span>
            <span>
              Your bet direction (YES/NO) is private. Only pool totals are
              public.
            </span>
          </div>

          {/* Transaction progress */}
          <TransactionProgress
            state={state}
            elapsed={elapsed}
            txId={txId}
            error={error}
          />

          {/* Submit button */}
          {state === "idle" && (
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors"
            >
              Bet {outcome.toUpperCase()}
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
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
            >
              Try Again
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
