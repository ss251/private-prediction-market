import { useState, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { getUsdcxBalance, getPublicBalance, formatUSDC, formatCredits, PROGRAM_ID } from "../lib/aleo";
import { useBetRecords } from "../hooks/useBetRecords";
import { incrementPoolTotal, accumulateBlindings } from "../lib/supabase";

interface Market {
  id: string;
  question: string;
  yesPool?: number;
  noPool?: number;
  paused?: boolean;
}

interface BetModalProps {
  market: Market;
  isOpen: boolean;
  onClose: () => void;
  onBetPlaced?: () => void;
  initialOutcome?: "yes" | "no";
}

// Fixed USDC tiers matching contract constants (6 decimals)
const TIERS = [
  { label: "$1", microcredits: 1_000_000 },
  { label: "$5", microcredits: 5_000_000 },
  { label: "$10", microcredits: 10_000_000 },
  { label: "$50", microcredits: 50_000_000 },
  { label: "$100", microcredits: 100_000_000 },
] as const;

/**
 * Modal for placing or adding to a bet on a prediction market.
 * Supports both `place_bet` (new position) and `add_to_bet` (existing position).
 * Displays current odds, potential winnings, and handles the full transaction lifecycle.
 */
export function BetModal({ market, isOpen, onClose, onBetPlaced, initialOutcome }: BetModalProps) {
  const { address, executeTransaction, transactionStatus } = useWallet();
  const [outcome, setOutcome] = useState<"yes" | "no">(initialOutcome ?? "yes");
  const [selectedTier, setSelectedTier] = useState(2); // default $10
  const amount = TIERS[selectedTier].label;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const { fetchBetRecords } = useBetRecords();
  const [existingRecord, setExistingRecord] = useState<string | null>(null);
  const [, setCheckingRecords] = useState(false);

  useEffect(() => {
    if (!isOpen || !address) {
      setBalance(null);
      setCreditsBalance(null);
      return;
    }
    setBalanceLoading(true);
    Promise.all([
      getUsdcxBalance(address).then(setBalance).catch(() => setBalance(null)),
      getPublicBalance(address).then(setCreditsBalance).catch(() => setCreditsBalance(null)),
    ]).finally(() => setBalanceLoading(false));
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

  const amountMicrocredits = TIERS[selectedTier].microcredits;
  const insufficientBalance = balance !== null && BigInt(amountMicrocredits) > balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !executeTransaction) return;

    // Tier is always valid — enforced by selector

    // Generate random nonce for Pedersen commitment privacy (hoisted for blinding tracking)
    const nonce = BigInt(Math.floor(Math.random() * 2 ** 64)) * BigInt(Math.floor(Math.random() * 2 ** 64));

    const resultTxId = await execute(
      async () => {
        const functionName = existingRecord ? "add_to_bet" : "place_bet";
        const inputs = existingRecord
          ? [existingRecord, `${amountMicrocredits}u128`, `${nonce}u128`]
          : [market.id, outcome === "yes" ? "true" : "false", `${amountMicrocredits}u128`, `${nonce}u128`];

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
      // Update pool aggregates + track blindings in Supabase (pools aren't on-chain during betting).
      // User positions are tracked by the indexer only — no frontend write to avoid double-counting.
      await Promise.all([
        incrementPoolTotal(market.id, outcome === "yes", amountMicrocredits).catch((e) => console.error("increment pool failed:", e)),
        accumulateBlindings(market.id, nonce).catch((e) => console.error("accumulate blindings failed:", e)),
      ]);
      if (onBetPlaced) onBetPlaced();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isExecuting = state !== "idle" && state !== "confirmed" && state !== "failed";
  const canSubmit = !isExecuting && !insufficientBalance && !market.paused;

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

          {/* Amount tier selector */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Amount (USDC)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {TIERS.map((tier, i) => (
                <button
                  key={tier.microcredits}
                  type="button"
                  onClick={() => setSelectedTier(i)}
                  disabled={isExecuting}
                  className={`py-2.5 px-1 rounded-xl border-2 text-sm font-mono font-bold transition-colors ${
                    selectedTier === i
                      ? "border-accent bg-accent/10 text-accent-light"
                      : "border-navy-600 text-gray-400 hover:border-navy-500"
                  } disabled:opacity-50`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between items-center text-sm">
              <span className="text-gray-500">
                {balanceLoading
                  ? "Loading balance..."
                  : balance !== null
                    ? `Available: ${formatUSDC(balance)}`
                    : "Connect wallet to see balance"}
              </span>
              {creditsBalance !== null && (
                <span className="text-gray-600 text-xs">
                  Gas: {(Number(creditsBalance) / 1_000_000).toFixed(2)} credits
                </span>
              )}
            </div>
            {insufficientBalance && (
              <p className="mt-1 text-sm text-rose-400">
                Insufficient balance for this bet
              </p>
            )}
          </div>

          {/* Bet info — privacy-aware */}
          <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Your Bet:</span>
              <span className="text-white font-mono">
                {amount} USDC
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Direction:</span>
              <span className={outcome === "yes" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {outcome.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm mt-1">
              <span className="text-gray-400">Odds & Payout:</span>
              <span className="text-privacy/60 font-mono text-xs flex items-center gap-1 ml-auto">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Revealed at resolution
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
              Only aggregate commitments update on-chain.
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
