import { useState, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import { PROGRAM_ID, formatCredits, getOracleOutcome } from "../lib/aleo";

interface ResolveModalProps {
  marketId: string;
  question: string;
  yesPool: bigint;
  noPool: bigint;
  oracleEnabled?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

export function ResolveModal({
  marketId,
  question,
  yesPool,
  noPool,
  oracleEnabled,
  isOpen,
  onClose,
  onResolved,
}: ResolveModalProps) {
  const { address, executeTransaction, transactionStatus } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  const [outcome, setOutcome] = useState<boolean>(true);
  const [oracleStatus, setOracleStatus] = useState<{ result: number; timestamp: number } | null>(null);
  const [oracleLoading, setOracleLoading] = useState(false);

  // Check oracle status when modal opens for oracle-enabled markets
  useEffect(() => {
    if (!isOpen || !oracleEnabled) return;
    setOracleLoading(true);
    getOracleOutcome(marketId).then(setOracleStatus).finally(() => setOracleLoading(false));
  }, [isOpen, oracleEnabled, marketId]);

  if (!isOpen) return null;

  const totalPool = yesPool + noPool;
  const oracleReady = oracleEnabled && oracleStatus && oracleStatus.result !== 0;

  const handleOracleResolve = async () => {
    if (!address || !executeTransaction) return;

    const resultTxId = await execute(
      async () => {
        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: "resolve_with_oracle",
          inputs: [marketId],
          fee: 500_000,
        });
        return result?.transactionId ?? "";
      },
      { statusFn: (txId: string) => transactionStatus(txId).then(r => r.status) }
    );

    if (resultTxId && onResolved) {
      onResolved();
    }
  };

  const handleResolve = async () => {
    if (!address || !executeTransaction) return;

    const resultTxId = await execute(
      async () => {
        const result = await executeTransaction({
          program: PROGRAM_ID,
          function: "resolve_market",
          inputs: [marketId, `${outcome}`],
          fee: 500_000,
        });
        return result?.transactionId ?? "";
      },
      { statusFn: (txId: string) => transactionStatus(txId).then(r => r.status) }
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-lg max-w-md w-full p-6 border-2 border-navy-600 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">Resolve Market</h2>
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

        {/* Market info */}
        <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Pool:</span>
            <span className="text-white font-mono">
              {formatCredits(totalPool)} credits
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">YES Pool:</span>
            <span className="text-emerald-400 font-mono">
              {formatCredits(yesPool)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">NO Pool:</span>
            <span className="text-rose-400 font-mono">
              {formatCredits(noPool)}
            </span>
          </div>
        </div>

        {/* Oracle resolution */}
        {oracleEnabled && state === "idle" && (
          <div className="mb-4 space-y-3">
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
                <span className="text-accent-light font-medium text-sm">Oracle Resolution</span>
              </div>
              {oracleLoading ? (
                <p className="text-gray-400 text-sm">Checking oracle status...</p>
              ) : oracleReady ? (
                <>
                  <p className="text-emerald-400 text-sm mb-2">
                    ✓ Oracle outcome available: <strong>{oracleStatus!.result === 1 ? "YES" : "NO"}</strong>
                  </p>
                  <button
                    onClick={handleOracleResolve}
                    className="w-full py-2 bg-accent hover:bg-accent-light rounded-xl text-navy-950 font-bold text-sm transition-colors"
                  >
                    Resolve with Oracle
                  </button>
                </>
              ) : (
                <p className="text-gray-400 text-sm">
                  Oracle outcome not yet available. You can resolve manually below, or wait for the oracle.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Manual outcome selection */}
        {state === "idle" && (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-gray-400">
              {oracleEnabled ? "Or manually select the winning outcome:" : "Select the winning outcome for this market."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOutcome(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                  outcome
                    ? "bg-emerald-600 text-white"
                    : "bg-navy-700 text-gray-400 hover:bg-navy-600"
                }`}
              >
                YES wins
              </button>
              <button
                type="button"
                onClick={() => setOutcome(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                  !outcome
                    ? "bg-rose-600 text-white"
                    : "bg-navy-700 text-gray-400 hover:bg-navy-600"
                }`}
              >
                NO wins
              </button>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
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
            className={`w-full py-3 rounded-xl text-white font-bold transition-colors ${
              outcome
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            Resolve as {outcome ? "YES" : "NO"}
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

        {state === "failed" && (
          <button
            onClick={handleResolve}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
