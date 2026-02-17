import { useState, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { getPublicBalance, formatCredits, PROGRAM_ID } from "../lib/aleo";
import { useBetRecords } from "../hooks/useBetRecords";
import { upsertUserPosition, incrementPoolTotal } from "../lib/supabase";

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
  initialOutcome?: "yes" | "no";
}

/**
 * Modal for placing or adding to a bet on a prediction market.
 * Supports both `place_bet` (new position) and `add_to_bet` (existing position).
 * Displays current odds, potential winnings, and handles the full transaction lifecycle.
 */
export function BetModal({ market, isOpen, onClose, onBetPlaced, initialOutcome }: BetModalProps) {
  const { address, executeTransaction, transactionStatus } = useWallet();
  const [outcome, setOutcome] = useState<"yes" | "no">(initialOutcome ?? "yes");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const { fetchBetRecords } = useBetRecords();
  const [existingRecord, setExistingRecord] = useState<string | null>(null);
  const [, setCheckingRecords] = useState(false);

  useEffect(() => {
    if (!isOpen || !address) {
      setBalance(null);
      return;
    }
    setBalanceLoading(true);
    getPublicBalance(address)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [isOpen, address]);

  useEffect(() => {
    if (!isOpen || !address) {
      setExistingRecord(null);
      return;
    }
    setCheckingRecords(true);
    fetchBetRecords(market.id).then((records) => {
      const match = records.find((r) => r.outcome === (outcome === "yes"));
      setExistingRecord(match?.raw ?? null);
    }).catch(() => {
      setExistingRecord(null);
    }).finally(() => {
      setCheckingRecords(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, address, outcome, market.id]);

  if (!isOpen) return null;

  const amountMicrocredits = amount ? Math.floor(parseFloat(amount) * 1_000_000) : 0;
  const insufficientBalance = balance !== null && amountMicrocredits > 0 && BigInt(amountMicrocredits) > balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !executeTransaction) return;

    if (amountMicrocredits < 1000) {
      return;
    }

    const resultTxId = await execute(
      async () => {
        const functionName = existingRecord ? "add_to_bet" : "place_bet";
        // Generate random nonce for Pedersen commitment privacy
        const nonce = BigInt(Math.floor(Math.random() * 2 ** 64)) * BigInt(Math.floor(Math.random() * 2 ** 64));
        const inputs = existingRecord
          ? [existingRecord, `${amountMicrocredits}u64`, `${nonce}u128`]
          : [market.id, outcome === "yes" ? "true" : "false", `${amountMicrocredits}u64`, `${nonce}u128`];

        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: functionName,
          inputs,
          fee: 500_000,
          privateFee: false,
        });
        return result?.transactionId ?? "";
      },
      { statusFn: (txId: string) => transactionStatus(txId).then(r => r.status) }
    );

    if (resultTxId && address) {
      // Report position + update pool aggregates in Supabase, then refetch
      // Await both so the UI has fresh data when onBetPlaced triggers refetch
      await Promise.all([
        upsertUserPosition(address, market.id, outcome === "yes", amountMicrocredits).catch((e) => console.error("upsert position failed:", e)),
        incrementPoolTotal(market.id, outcome === "yes", amountMicrocredits).catch((e) => console.error("increment pool failed:", e)),
      ]);
      if (onBetPlaced) onBetPlaced();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const totalPool = market.yesPool + market.noPool;
  const selectedPool = outcome === "yes" ? market.yesPool : market.noPool;

  const currentOdds =
    totalPool > 0 && selectedPool > 0
      ? ((totalPool / selectedPool) * 0.98).toFixed(2)
      : "2.00";

  const isExecuting = state !== "idle" && state !== "confirmed" && state !== "failed";
  const canSubmit = !isExecuting && amount && parseFloat(amount) >= 0.001 && !insufficientBalance && !market.paused;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-lg max-w-md w-full p-6 border-2 border-navy-600 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">Place Your Bet</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="text-gray-300 mb-6">{market.question}</p>

        {market.paused && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
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
              className={`p-4 rounded-xl border-2 transition-colors ${
                outcome === "yes"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-navy-600 text-gray-400 hover:border-navy-500"
              } disabled:opacity-50`}
            >
              <div className="mb-1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="font-bold">YES</div>
            </button>
            <button
              type="button"
              onClick={() => setOutcome("no")}
              disabled={isExecuting}
              className={`p-4 rounded-xl border-2 transition-colors ${
                outcome === "no"
                  ? "border-rose-500 bg-rose-500/10 text-rose-400"
                  : "border-navy-600 text-gray-400 hover:border-navy-500"
              } disabled:opacity-50`}
            >
              <div className="mb-1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
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
              className="w-full p-3 bg-navy-900 border border-navy-600 rounded-xl text-white placeholder-gray-500 focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none disabled:opacity-50"
              required
            />
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
                  className="text-accent-light hover:text-accent text-xs transition-colors"
                  disabled={isExecuting}
                >
                  Max
                </button>
              )}
            </div>
            {insufficientBalance && (
              <p className="mt-1 text-sm text-rose-400">
                Insufficient balance for this bet
              </p>
            )}
          </div>

          {/* Odds display */}
          <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current Odds:</span>
              <span className="text-white font-mono">{currentOdds}x</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Potential Win:</span>
              <span className="text-emerald-400 font-mono">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>
              Your bet is fully private — direction is encrypted in your Bet record
              and never appears on-chain. Pool totals are only revealed at resolution.
              Only a bet count is incremented publicly.
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
              className="w-full py-3 btn-primary rounded-xl font-bold"
            >
              {existingRecord ? `Add to ${outcome.toUpperCase()} Position` : `Bet ${outcome.toUpperCase()}`}
            </button>
          )}

          {state === "confirmed" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-colors"
              >
                Done
              </button>
              <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1.5">
                <span className="css-spinner-sm" />
                Pool data will update in a few moments
              </p>
            </div>
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

          {state === "failed" && (
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold transition-colors"
            >
              Try Again
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
