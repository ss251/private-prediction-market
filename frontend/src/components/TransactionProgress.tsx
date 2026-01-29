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
  // Don't show anything in idle state
  if (state === "idle") return null;

  // Calculate progress percentage (cap at 95% until complete)
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
    <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
      {/* Status message */}
      <div className="flex items-center gap-2 mb-2">
        {state === "confirmed" ? (
          <span className="text-green-400 text-lg">&#10003;</span>
        ) : state === "failed" ? (
          <span className="text-red-400 text-lg">&#10005;</span>
        ) : (
          <span className="animate-spin text-blue-400">&#8987;</span>
        )}
        <span
          className={`font-medium ${
            state === "confirmed"
              ? "text-green-400"
              : state === "failed"
                ? "text-red-400"
                : "text-white"
          }`}
        >
          {stateMessages[state]}
        </span>
      </div>

      {/* Progress bar */}
      {state !== "confirmed" && state !== "failed" && (
        <div className="mb-2">
          <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
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
              className="font-mono text-blue-400 hover:text-blue-300"
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
        <div className="mt-2 text-sm text-red-400 bg-red-900/30 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
