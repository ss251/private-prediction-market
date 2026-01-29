import { useState, useEffect } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import {
  PROGRAM_ID,
  getOracleAttestedData,
  formatCredits,
} from "../lib/aleo";

interface OracleResolveModalProps {
  marketId: string;
  question: string;
  priceThreshold: bigint;
  oracleRequestHash: bigint;
  yesPool: bigint;
  noPool: bigint;
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

export function OracleResolveModal({
  marketId,
  question,
  priceThreshold,
  oracleRequestHash,
  yesPool,
  noPool,
  isOpen,
  onClose,
  onResolved,
}: OracleResolveModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  const [oracleData, setOracleData] = useState<{
    data: bigint;
    timestamp: bigint;
  } | null>(null);
  const [oracleLoading, setOracleLoading] = useState(false);
  const [oracleError, setOracleError] = useState<string | null>(null);

  // Check oracle data availability on mount
  useEffect(() => {
    if (!isOpen) return;
    checkOracleData();
  }, [isOpen, oracleRequestHash]);

  async function checkOracleData() {
    setOracleLoading(true);
    setOracleError(null);
    try {
      const data = await getOracleAttestedData(oracleRequestHash);
      setOracleData(data);
      if (!data) {
        setOracleError(
          "Oracle data not yet available on-chain. The attestation must be submitted to official_oracle_v2.aleo first."
        );
      }
    } catch {
      setOracleError("Failed to check oracle data.");
    } finally {
      setOracleLoading(false);
    }
  }

  if (!isOpen) return null;

  const predictedOutcome = oracleData
    ? oracleData.data >= priceThreshold
    : null;

  const totalPool = yesPool + noPool;

  const handleResolve = async () => {
    if (!publicKey || !requestTransaction) return;

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "resolve_with_oracle",
          [marketId],
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
    onClose();
  };

  const isExecuting =
    state !== "idle" && state !== "confirmed" && state !== "failed";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">Oracle Resolution</h2>
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
            <span className="text-gray-400">Price Threshold:</span>
            <span className="text-white font-mono">
              {priceThreshold.toString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Oracle Request:</span>
            <span className="text-white font-mono text-xs truncate max-w-[200px]">
              {oracleRequestHash.toString()}
            </span>
          </div>
        </div>

        {/* Oracle data status */}
        {oracleLoading && (
          <div className="mb-4 p-3 bg-gray-700/50 rounded-lg text-gray-400 text-center animate-pulse">
            Checking oracle data...
          </div>
        )}

        {oracleError && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-400 text-sm">
            {oracleError}
            <button
              onClick={checkOracleData}
              className="block mt-2 text-yellow-300 hover:text-yellow-200 underline text-xs"
            >
              Refresh
            </button>
          </div>
        )}

        {oracleData && (
          <div className="mb-4 space-y-2">
            <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Attested Value:</span>
                <span className="text-white font-mono font-bold">
                  {oracleData.data.toString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Attestation Time:</span>
                <span className="text-gray-300 font-mono text-xs">
                  {new Date(
                    Number(oracleData.timestamp) * 1000
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Predicted outcome */}
            <div
              className={`p-3 rounded-lg text-center font-bold ${
                predictedOutcome
                  ? "bg-green-900/50 text-green-400 border border-green-700"
                  : "bg-red-900/50 text-red-400 border border-red-700"
              }`}
            >
              Predicted Outcome: {predictedOutcome ? "YES" : "NO"} wins
              <div className="text-xs font-normal mt-1 opacity-75">
                {oracleData.data.toString()}{" "}
                {predictedOutcome ? ">=" : "<"}{" "}
                {priceThreshold.toString()} (threshold)
              </div>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="text-xs text-gray-500 mb-4 flex items-start gap-2">
          <span>&#9432;</span>
          <span>
            Oracle resolution reads attested data from official_oracle_v2.aleo
            and compares against the configured price threshold. YES wins if the
            attested value is greater than or equal to the threshold.
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
        {state === "idle" && oracleData && (
          <button
            onClick={handleResolve}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold transition-colors"
          >
            Resolve with Oracle
          </button>
        )}

        {state === "idle" && !oracleData && !oracleLoading && (
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

        {state === "failed" && oracleData && (
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
