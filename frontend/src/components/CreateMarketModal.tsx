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
import { saveMarketMeta } from "../lib/marketRegistry";

/* ── Inline Calendar Picker ──────────────────────────────────────────── */

function CalendarPicker({
  value,
  minDate,
  onChange,
}: {
  value: string;
  minDate: string;
  onChange: (date: string) => void;
}) {
  const today = new Date();
  const initial = value
    ? new Date(value + "T00:00:00")
    : new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const minD = new Date(minDate + "T00:00:00");

  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const canGoPrev = (() => {
    const prevLast =
      viewMonth === 0
        ? new Date(viewYear - 1, 11, 31)
        : new Date(viewYear, viewMonth, 0);
    return prevLast >= minD;
  })();

  const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="mt-2 bg-navy-900 border border-navy-600 rounded-xl p-3 select-none">
      {/* Month / year nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-navy-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-200 tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-navy-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-600 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (day === null)
            return <div key={`e${i}`} />;

          const cellDate = new Date(viewYear, viewMonth, day);
          const key = toKey(cellDate);
          const isSelected = key === value;
          const isDisabled = cellDate < minD;
          const isToday = toKey(today) === key;

          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(key)}
              className={`
                relative h-8 rounded-lg text-xs font-medium transition-all
                ${isSelected
                  ? "bg-accent text-white shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                  : isDisabled
                    ? "text-gray-700 cursor-not-allowed"
                    : "text-gray-300 hover:bg-navy-700 hover:text-white"
                }
              `}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent/60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── CreateMarketModal ──────────────────────────────────────────────── */

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type Phase =
  | "loading"
  | "not-deployed"
  | "not-admin"
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

  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showCustomDate, setShowCustomDate] = useState(false);

  const [marketCount, setMarketCount] = useState<number | null>(null);
  const [estimatedBlock, setEstimatedBlock] = useState<number | null>(null);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [createdMarketId, setCreatedMarketId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !publicKey) return;
    setPhase("loading");

    Promise.all([
      getAdminAddress(),
      getMarketCount(),
      getLatestHeight(),
    ]).then(([admin, count, height]) => {
      setMarketCount(count);
      setCurrentHeight(height);

      if (!admin) {
        setPhase("not-deployed");
      } else if (admin !== publicKey) {
        setPhase("not-admin");
      } else {
        setPhase("form");
      }
    });
  }, [isOpen, publicKey]);

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

  const DURATION_PRESETS = [
    { label: "1 Week", days: 7, key: "1w" },
    { label: "2 Weeks", days: 14, key: "2w" },
    { label: "1 Month", days: 30, key: "1m" },
    { label: "3 Months", days: 90, key: "3m" },
  ];

  const selectPreset = (key: string, days: number) => {
    const date = new Date(Date.now() + days * 86400 * 1000);
    setEndDate(date.toISOString().split("T")[0]);
    setSelectedPreset(key);
    setShowCustomDate(false);
  };

  const selectCustomDate = (value: string) => {
    setEndDate(value);
    setSelectedPreset("custom");
  };

  if (!isOpen) return null;

  const nextMarketId = marketCount !== null ? marketCount + 1 : null;

  const canSubmit =
    question.trim().length > 0 &&
    endDate &&
    estimatedBlock !== null &&
    estimatedBlock > (currentHeight ?? 0);

  const handleCreateMarket = async () => {
    if (!publicKey || !requestTransaction || !estimatedBlock) return;

    setPhase("creating");

    const nextId = (marketCount ?? 0) + 1;
    const marketId = `${nextId}field`;

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

    // Persist metadata so it's available on reload without manual JSON editing
    saveMarketMeta(marketId, { question, endDate });

    setCreatedMarketId(marketId);
    setPhase("success");
  };

  const handleClose = () => {
    const wasSuccess = phase === "success";
    setQuestion("");
    setEndDate("");
    setSelectedPreset(null);
    setShowCustomDate(false);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 rounded-2xl max-w-lg w-full p-6 border border-navy-600 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-heading text-xl font-bold text-white">Create Market</h2>
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

        {/* Loading */}
        {phase === "loading" && (
          <div className="text-center text-gray-400 py-8 flex items-center justify-center gap-2">
            <span className="css-spinner" />
            Checking contract state...
          </div>
        )}

        {/* Contract Not Deployed / Not Initialized */}
        {phase === "not-deployed" && (
          <div className="space-y-4">
            <div className="p-4 bg-navy-900/60 border border-navy-600 rounded-xl text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-gray-300 font-medium mb-1">Contract Not Ready</p>
              <p className="text-gray-500 text-sm">
                The prediction market contract has not been deployed or initialized yet.
                Deploy the contract and run the <code className="text-gray-400 bg-navy-900 px-1 py-0.5 rounded">initialize</code> transition first.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full py-3 bg-navy-700 hover:bg-navy-600 rounded-xl text-white font-bold transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Not Admin */}
        {phase === "not-admin" && (
          <div className="space-y-4">
            <div className="p-4 bg-navy-900/60 border border-navy-600 rounded-xl text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-gray-300 font-medium mb-1">Admin Only</p>
              <p className="text-gray-500 text-sm">
                Market creation is restricted to the contract admin.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full py-3 bg-navy-700 hover:bg-navy-600 rounded-xl text-white font-bold transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Success Phase */}
        {phase === "success" && createdMarketId && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div className="text-emerald-400 font-bold text-lg">
                Market Created
              </div>
              <div className="text-gray-300 mt-2">
                Market ID:{" "}
                <span className="font-mono">{createdMarketId}</span>
              </div>
            </div>

            <div className="p-3 bg-navy-900/60 border border-navy-600 rounded-xl text-sm text-gray-400 text-center">
              Market metadata saved automatically. It will appear on the
              homepage once the transaction confirms on-chain.
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold transition-colors"
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
                  className="w-full p-3 bg-navy-900 border border-navy-600 rounded-xl text-white placeholder-gray-500 focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm text-gray-400 mb-1.5">
                  End Date
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => selectPreset(p.key, p.days)}
                      className={`py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                        selectedPreset === p.key
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-navy-900 text-gray-400 border border-navy-600 hover:border-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className={`w-full p-3 rounded-xl text-left text-sm transition-colors flex items-center gap-2 ${
                    showCustomDate || selectedPreset === "custom"
                      ? "bg-accent/10 border border-accent/40 text-accent"
                      : "bg-navy-900 border border-navy-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {selectedPreset === "custom" && endDate
                    ? new Date(endDate + "T00:00:00").toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Pick a custom date..."}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`ml-auto transition-transform ${showCustomDate ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showCustomDate && (
                  <CalendarPicker
                    value={endDate}
                    minDate={minDate}
                    onChange={(date) => {
                      selectCustomDate(date);
                      setShowCustomDate(false);
                    }}
                  />
                )}
                {endDate && estimatedBlock !== null && daysUntil !== null && (
                  <div className="mt-2 p-2 bg-navy-900/60 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {new Date(endDate + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-gray-400">
                      Block ~{estimatedBlock.toLocaleString()} ({daysUntil}d)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            {canSubmit && (
              <div className="bg-navy-900/60 border border-navy-600 rounded-xl p-3 space-y-1 text-sm">
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
              className="w-full py-3 btn-primary rounded-xl font-bold"
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
                className="w-full py-3 bg-navy-700 rounded-xl text-white font-bold flex items-center justify-center gap-2"
              >
                <span className="css-spinner-sm" />
                {stateMessages[state]}
              </button>
            )}

            {state === "failed" && (
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold transition-colors"
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
