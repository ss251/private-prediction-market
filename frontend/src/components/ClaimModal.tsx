import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { calculatePayout, formatCredits } from "../lib/aleo";
import type { StoredBet } from "../hooks/useBets";

interface ClaimModalProps {
  marketId: string;
  question: string;
  yesPool: bigint;
  noPool: bigint;
  winningOutcome: boolean;
  bets: StoredBet[];
  isOpen: boolean;
  onClose: () => void;
  onClaimed?: (txId: string) => void;
}

const PROGRAM_ID = "prediction_market_test001.aleo";

export function ClaimModal({
  marketId,
  question,
  yesPool,
  noPool,
  winningOutcome,
  bets,
  isOpen,
  onClose,
  onClaimed,
}: ClaimModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } = useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  if (!isOpen) return null;

  // Calculate payouts for each bet
  const betPayouts = bets.map((bet) => {
    const payout = calculatePayout(
      BigInt(bet.amount),
      yesPool,
      noPool,
      bet.outcome,
      winningOutcome
    );
    return {
      ...bet,
      payout,
      isWinner: bet.outcome === winningOutcome,
    };
  });

  const totalPayout = betPayouts.reduce((sum, b) => sum + b.payout, 0n);
  const hasWinningBets = betPayouts.some((b) => b.isWinner);

  const handleClaim = async () => {
    if (!publicKey || !requestTransaction || !hasWinningBets) return;

    // For each winning bet, submit a claim transaction
    // In practice, the wallet would need the actual Bet record
    // For MVP, we submit with the calculated payout amount
    const winningBet = betPayouts.find((b) => b.isWinner);
    if (!winningBet) return;

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "claim_winnings",
          [
            // The Bet record would be passed from the wallet's decrypted records
            // For now, we pass the payout amount for validation
            `${winningBet.payout}u64`, // claimed_amount: u64
          ],
          500_000 // fee for claim tx
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
    );

    if (resultTxId && onClaimed) {
      onClaimed(resultTxId);
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
          <h2 className="text-xl font-bold text-white">Claim Winnings</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            &#10005;
          </button>
        </div>

        <p className="text-gray-300 mb-4">{question}</p>

        {/* Outcome result */}
        <div
          className={`mb-4 p-3 rounded-lg text-center font-bold ${
            winningOutcome
              ? "bg-green-900/50 text-green-400 border border-green-700"
              : "bg-red-900/50 text-red-400 border border-red-700"
          }`}
        >
          Result: {winningOutcome ? "YES" : "NO"} won
        </div>

        {/* Your bets summary */}
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Your Bets</h3>
          {betPayouts.map((bet, i) => (
            <div
              key={bet.txId}
              className={`p-3 rounded-lg border ${
                bet.isWinner
                  ? "border-green-700 bg-green-900/20"
                  : "border-red-700 bg-red-900/20"
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className={bet.isWinner ? "text-green-400" : "text-red-400"}>
                  {bet.outcome ? "YES" : "NO"} - {bet.isWinner ? "Winner" : "Lost"}
                </span>
                <span className="text-gray-300">
                  {formatCredits(BigInt(bet.amount))} credits
                </span>
              </div>
              {bet.isWinner && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-400">Payout:</span>
                  <span className="text-green-400 font-mono">
                    {formatCredits(bet.payout)} credits
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total payout */}
        {hasWinningBets && (
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Total Payout:</span>
              <span className="text-green-400 font-bold font-mono">
                {formatCredits(totalPayout)} credits
              </span>
            </div>
          </div>
        )}

        {!hasWinningBets && (
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-center text-gray-400">
            No winning bets to claim.
          </div>
        )}

        {/* Note about record requirement */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <span>&#9432;</span>
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
        {state === "idle" && hasWinningBets && (
          <button
            onClick={handleClaim}
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-colors"
          >
            Claim {formatCredits(totalPayout)} Credits
          </button>
        )}

        {state === "idle" && !hasWinningBets && (
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

        {state === "failed" && hasWinningBets && (
          <button
            onClick={handleClaim}
            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
