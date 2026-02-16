/**
 * Modal for the commit phase of commit-reveal betting.
 * Users commit to a bet by submitting a hash of their bet details,
 * locking credits without revealing direction. The nonce is stored
 * locally for the reveal phase.
 */
import { useState, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { getPublicBalance, formatCredits, PROGRAM_ID } from "../lib/aleo";
import { saveCommitment } from "../lib/commitmentStore";
import { generateNonce } from "../lib/commitReveal";

interface CommitBetModalProps {
  market: {
    id: string;
    question: string;
    yesPool: number;
    noPool: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onCommitted?: () => void;
}

/** Modal component for committing to a bet without revealing direction. */
export function CommitBetModal({
  market,
  isOpen,
  onClose,
  onCommitted,
}: CommitBetModalProps) {
  const { address, executeTransaction, transactionStatus } = useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !address) return;
    setBalanceLoading(true);
    getPublicBalance(address)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [isOpen, address]);

  if (!isOpen || !transactionStatus) return null;

  const amountMicrocredits = amount
    ? Math.floor(parseFloat(amount) * 1_000_000)
    : 0;
  const insufficientBalance =
    balance !== null &&
    amountMicrocredits > 0 &&
    BigInt(amountMicrocredits) > balance;

  const handleCommit = async () => {
    if (!address || !executeTransaction || amountMicrocredits < 1000) return;

    const nonce = generateNonce();
    const commitInput = `{ market_id: ${market.id}, direction: ${outcome === "yes"}, amount: ${amountMicrocredits}u64, nonce: ${nonce} }`;

    const resultTxId = await execute(
      async () => {
        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: "commit_bet",
          inputs: [market.id, commitInput, `${amountMicrocredits}u64`],
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
      await saveCommitment({
        marketId: market.id,
        direction: outcome === "yes",
        amount: amountMicrocredits,
        nonce,
        commitHash: commitInput,
        txId: resultTxId,
        createdAt: Date.now(),
        revealed: false,
      });
      if (onCommitted) onCommitted();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isExecuting =
    state !== "idle" && state !== "confirmed" && state !== "failed";
  const canSubmit =
    !isExecuting &&
    amount &&
    parseFloat(amount) >= 0.001 &&
    !insufficientBalance;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-lg max-w-md w-full p-6 border-2 border-navy-600 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">
            Commit Bet (Private)
          </h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 mb-4">{market.question}</p>

        {/* Privacy notice */}
        <div className="mb-4 p-3 rounded-xl bg-privacy/5 border border-privacy/15 text-xs text-privacy/80 flex items-start gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="mt-0.5 shrink-0"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>
            Commit-reveal hides your bet direction until the reveal phase. Your
            nonce is stored locally —{" "}
            <strong>do not clear browser data</strong> before revealing.
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCommit();
          }}
        >
          {/* Outcome selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setOutcome("yes")}
              disabled={isExecuting}
              className={`p-3 rounded-xl border-2 transition-colors ${
                outcome === "yes"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-navy-600 text-gray-400 hover:border-navy-500"
              }`}
            >
              <div className="font-bold">YES</div>
            </button>
            <button
              type="button"
              onClick={() => setOutcome("no")}
              disabled={isExecuting}
              className={`p-3 rounded-xl border-2 transition-colors ${
                outcome === "no"
                  ? "border-rose-500 bg-rose-500/10 text-rose-400"
                  : "border-navy-600 text-gray-400 hover:border-navy-500"
              }`}
            >
              <div className="font-bold">NO</div>
            </button>
          </div>

          {/* Amount */}
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
            <div className="mt-1 text-sm text-gray-500">
              {balanceLoading
                ? "Loading..."
                : balance !== null
                  ? `Available: ${formatCredits(balance)} credits`
                  : "Connect wallet"}
            </div>
            {insufficientBalance && (
              <p className="mt-1 text-sm text-rose-400">
                Insufficient balance
              </p>
            )}
          </div>

          <TransactionProgress
            state={state}
            elapsed={elapsed}
            txId={txId}
            error={error}
          />

          {state === "idle" && (
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 btn-primary rounded-xl font-bold"
            >
              Commit Bet
            </button>
          )}

          {state === "confirmed" && (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-colors"
            >
              Done — Remember to Reveal!
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
