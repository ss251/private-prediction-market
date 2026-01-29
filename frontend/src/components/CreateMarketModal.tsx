import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import {
  Transaction,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useTransaction, stateMessages } from "../hooks/useTransaction";
import { TransactionProgress } from "./TransactionProgress";
import {
  PROGRAM_ID,
  getAdminAddress,
  getMarketCount,
  estimateBlockHeight,
  getLatestHeight,
} from "../lib/aleo";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type Phase =
  | "loading"
  | "needs-init"
  | "initializing"
  | "form"
  | "creating"
  | "success";

export function CreateMarketModal({
  isOpen,
  onClose,
  onCreated,
}: CreateMarketModalProps) {
  const { publicKey, requestTransaction, transactionStatus, getExecution } =
    useWallet();
  const { state, error, txId, elapsed, execute, reset } = useTransaction();

  // Form state
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");

  // Derived state
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const [estimatedBlock, setEstimatedBlock] = useState<number | null>(null);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [createdMarketId, setCreatedMarketId] = useState<string | null>(null);

  // Check contract state on open
  useEffect(() => {
    if (!isOpen) return;
    setPhase("loading");

    Promise.all([
      getAdminAddress(),
      getMarketCount(),
      getLatestHeight(),
    ]).then(([admin, count, height]) => {
      setMarketCount(count);
      setCurrentHeight(height);

      if (!admin) {
        setPhase("needs-init");
      } else {
        setPhase("form");
      }
    });
  }, [isOpen]);

  // Estimate block height when end date changes
  useEffect(() => {
    if (!endDate) {
      setEstimatedBlock(null);
      return;
    }
    const target = new Date(endDate + "T23:59:59");
    if (isNaN(target.getTime())) {
      setEstimatedBlock(null);
      return;
    }
    estimateBlockHeight(target).then(setEstimatedBlock);
  }, [endDate]);

  const daysUntil = useMemo(() => {
    if (!endDate) return null;
    return Math.max(
      0,
      Math.ceil(
        (new Date(endDate + "T23:59:59").getTime() - Date.now()) /
          (86400 * 1000)
      )
    );
  }, [endDate]);

  const minDate = useMemo(() => {
    return new Date(Date.now() + 86400 * 1000).toISOString().split("T")[0];
  }, []);

  if (!isOpen) return null;

  const nextMarketId = marketCount !== null ? marketCount + 1 : null;

  const canSubmit =
    question.trim().length > 0 &&
    endDate &&
    estimatedBlock !== null &&
    estimatedBlock > (currentHeight ?? 0);

  // Initialize contract (sets connected wallet as admin)
  const handleInitialize = async () => {
    if (!publicKey || !requestTransaction) return;

    setPhase("initializing");

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "initialize",
          [publicKey],
          1_000_000,
          false
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
    );

    if (resultTxId) {
      reset();
      setPhase("form");
    }
  };

  const handleCreateMarket = async () => {
    if (!publicKey || !requestTransaction || !estimatedBlock) return;

    setPhase("creating");

    const nextId = (marketCount ?? 0) + 1;
    const marketId = `${nextId}field`;

    // Use placeholder label hashes (BHP256 of "YES" and "NO")
    // In production these would be computed via WebWorker
    const yesLabelHash = "1234field";
    const noLabelHash = "5678field";

    const resultTxId = await execute(
      async () => {
        const tx = Transaction.createTransaction(
          publicKey,
          WalletAdapterNetwork.TestnetBeta,
          PROGRAM_ID,
          "create_market",
          [marketId, `${estimatedBlock}u32`, yesLabelHash, noLabelHash],
          1_000_000,
          false
        );

        const result = await requestTransaction(tx);
        return result;
      },
      { statusFn: transactionStatus, getExecutionFn: getExecution }
    );

    if (!resultTxId) {
      setPhase("form");
      return;
    }

    setCreatedMarketId(marketId);
    setPhase("success");
  };

  const handleClose = () => {
    const wasSuccess = phase === "success";
    setQuestion("");
    setEndDate("");
    setMarketCount(null);
    setEstimatedBlock(null);
    setCurrentHeight(null);
    setPhase("loading");
    setCreatedMarketId(null);
    reset();
    onClose();
    if (wasSuccess && onCreated) {
      onCreated();
    }
  };

  const isExecuting =
    state !== "idle" && state !== "confirmed" && state !== "failed";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">Create Market</h2>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            &#10005;
          </button>
        </div>

        {/* Loading */}
        {phase === "loading" && (
          <div className="text-center text-gray-400 py-8 animate-pulse">
            Checking contract state...
          </div>
        )}

        {/* Needs Initialization */}
        {phase === "needs-init" && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
              <p className="text-yellow-400 font-semibold mb-2">
                Contract Not Initialized
              </p>
              <p className="text-gray-300 text-sm">
                The prediction market contract has not been initialized yet.
                Click below to set your connected wallet as the admin. This is a
                one-time on-chain transaction.
              </p>
            </div>

            <TransactionProgress
              state={state}
              elapsed={elapsed}
              txId={txId}
              error={error}
            />

            {state === "idle" && (
              <button
                type="button"
                onClick={handleInitialize}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition-colors"
              >
                Initialize Contract
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
                type="button"
                onClick={handleInitialize}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Initializing */}
        {phase === "initializing" && (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              Initializing contract...
            </div>

            <TransactionProgress
              state={state}
              elapsed={elapsed}
              txId={txId}
              error={error}
            />

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

            {state === "confirmed" && (
              <button
                type="button"
                onClick={() => {
                  reset();
                  setPhase("form");
                }}
                className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-colors"
              >
                Continue to Create Market
              </button>
            )}

            {state === "failed" && (
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
              >
                Close
              </button>
            )}
          </div>
        )}

        {/* Success Phase */}
        {phase === "success" && createdMarketId && (
          <div className="space-y-4">
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-center">
              <div className="text-green-400 text-3xl mb-2">&#10003;</div>
              <div className="text-green-400 font-bold text-lg">
                Market Created
              </div>
              <div className="text-gray-300 mt-2">
                Market ID:{" "}
                <span className="font-mono">{createdMarketId}</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">
                Add this entry to{" "}
                <code className="text-gray-300">public/markets.json</code>:
              </p>
              <pre className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
                {JSON.stringify(
                  {
                    [createdMarketId]: {
                      question,
                      endDate,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Form Phase */}
        {phase === "form" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                Market Details
              </h3>

              <div className="mb-3">
                <label className="block text-sm text-gray-400 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Will Bitcoin reach $150k by end of 2026?"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm text-gray-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={minDate}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
                {estimatedBlock !== null && daysUntil !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    End Block: ~{estimatedBlock.toLocaleString()} (~{daysUntil}{" "}
                    days from now)
                  </p>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            {canSubmit && (
              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3 space-y-1 text-sm">
                <div className="text-gray-400 uppercase text-xs font-semibold mb-2">
                  Preview
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Market ID:</span>
                  <span className="text-white font-mono">
                    {nextMarketId}field
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">End Block:</span>
                  <span className="text-white font-mono">
                    {estimatedBlock?.toLocaleString()} (~{daysUntil} days)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Resolution:</span>
                  <span className="text-gray-300">Admin (manual)</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateMarket}
              disabled={!canSubmit}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors"
            >
              Create Market
            </button>
          </div>
        )}

        {/* Creating Phase */}
        {phase === "creating" && (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              Creating market on-chain...
            </div>

            <TransactionProgress
              state={state}
              elapsed={elapsed}
              txId={txId}
              error={error}
            />

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
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-colors"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
