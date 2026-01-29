import { type TransactionState, stateMessages } from "../hooks/useTransaction";

interface TransactionProgressProps {
  state: TransactionState;
  elapsed: number;
  estimatedTime?: number;
  txId?: string | null;
  error?: string | null;
}

export function TransactionProgress({
  state,
  elapsed,
  estimatedTime = 45,
  txId,
  error,
}: TransactionProgressProps) {
  if (state === "idle") return null;

  const progressPercent =
    state === "confirmed"
      ? 100
      : state === "proving"
        ? Math.min((elapsed / estimatedTime) * 100, 95)
        : state === "broadcasting"
          ? 96
          : state === "confirming"
            ? 98
            : 50;

  return (
    <div className="mt-4 p-4 bg-navy-900/60 border border-navy-600 rounded-xl">
      {/* Status message */}
      <div className="flex items-center gap-2 mb-2">
        {state === "confirmed" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : state === "failed" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <span className={`css-spinner-sm ${state === "proving" ? "proof-pulse" : ""}`} />
        )}
        <span
          className={`font-medium ${
            state === "confirmed"
              ? "text-emerald-400"
              : state === "failed"
                ? "text-rose-400"
                : "text-white"
          }`}
        >
          {stateMessages[state]}
        </span>
      </div>

      {/* Progress bar */}
      {state !== "confirmed" && state !== "failed" && (
        <div className="mb-2">
          <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full progress-gradient transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Timer during proving */}
      {state === "proving" && (
        <div className="text-sm text-gray-400 mb-2">
          <span className="font-mono">
            {elapsed}s / ~{estimatedTime}s
          </span>
        </div>
      )}

      {/* Explanation */}
      {state === "proving" && (
        <p className="text-xs text-gray-500">
          ZK proofs ensure your bet remains private. This computation runs
          locally on your device.
        </p>
      )}

      {/* Transaction ID */}
      {txId && state !== "failed" && (
        <div className="mt-2 text-xs text-gray-400">
          <span>TX: </span>
          {txId.startsWith("at1") ? (
            <a
              href={`https://testnet.explorer.provable.com/transaction/${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-accent-light hover:text-accent"
            >
              {txId.slice(0, 16)}...
            </a>
          ) : (
            <span className="font-mono text-gray-500">
              {txId.slice(0, 16)}...
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
