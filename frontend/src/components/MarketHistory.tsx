// Market history modal: overview, user position, privacy notice

import { useMarketHistory } from "../hooks/useMarketHistory";
import { formatCredits, formatPool, MarketStatus, type MarketData } from "../lib/aleo";

interface MarketHistoryProps {
  marketId: string;
  question: string;
  userAddress: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialMarketData?: MarketData | null;
}

const STATUS_LABELS: Record<number, { text: string; className: string }> = {
  [MarketStatus.OPEN]: {
    text: "OPEN",
    className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  [MarketStatus.CLOSED]: {
    text: "CLOSED",
    className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  [MarketStatus.RESOLVED]: {
    text: "RESOLVED",
    className: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  },
  [MarketStatus.CANCELLED]: {
    text: "CANCELLED",
    className: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  },
};

export function MarketHistory({
  marketId,
  question,
  userAddress,
  isOpen,
  onClose,
  initialMarketData,
}: MarketHistoryProps) {
  const {
    userPosition,
    marketData,
    isLoading,
  } = useMarketHistory(marketId, userAddress, isOpen, initialMarketData);

  if (!isOpen) return null;

  const totalPool =
    (marketData?.yesPool ?? 0n) + (marketData?.noPool ?? 0n);
  const yesPercent =
    totalPool > 0n
      ? Number((marketData!.yesPool * 1000n) / totalPool) / 10
      : 50;
  const noPercent = 100 - yesPercent;

  const statusInfo = marketData
    ? STATUS_LABELS[marketData.status] ?? {
        text: "UNKNOWN",
        className: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
      }
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-navy-800 rounded-lg border-2 border-navy-600 shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-navy-600">
          <div className="flex-1 mr-4">
            <h2 className="font-heading text-lg font-semibold text-white">{question}</h2>
            <p className="text-xs text-gray-500 mt-1 font-mono">Market {marketId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Market Overview */}
          {isLoading ? (
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <span className="css-spinner-sm" />
              Loading market data...
            </div>
          ) : marketData ? (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Market Overview
              </h3>
              <div className="bg-navy-900 rounded-xl p-4 space-y-3 border border-navy-600">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusInfo && (
                    <span
                      className={`text-xs px-2 py-1 rounded-lg ${statusInfo.className}`}
                    >
                      {statusInfo.text}
                    </span>
                  )}
                  {marketData.paused && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      PAUSED
                    </span>
                  )}
                  {marketData.endTime && (
                    <span className="text-xs text-gray-600">
                      Ends at block #{marketData.endTime.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Pool bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-emerald-400">
                      YES {yesPercent.toFixed(1)}%
                    </span>
                    <span className="text-rose-400">
                      NO {noPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-navy-700 rounded-full overflow-hidden flex">
                    <div
                      className="pool-bar-yes transition-all"
                      style={{ width: `${yesPercent}%` }}
                    />
                    <div
                      className="pool-bar-no transition-all"
                      style={{ width: `${noPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm text-gray-400">
                  <span>
                    YES: {formatPool(marketData.yesPool)} credits
                  </span>
                  <span>
                    NO: {formatPool(marketData.noPool)} credits
                  </span>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  Total Pool: {formatCredits(totalPool)} credits
                </div>

                {marketData.status === MarketStatus.RESOLVED &&
                  marketData.outcome !== undefined && (
                    <div
                      className={`p-2 rounded-xl text-center text-sm font-bold ${
                        marketData.outcome
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      Resolved: {marketData.outcome ? "YES" : "NO"} won
                    </div>
                  )}
              </div>
            </section>
          ) : (
            <div className="text-rose-400 text-sm">
              Failed to load market data.
            </div>
          )}

          {/* User's Position (from wallet records) */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Your Position
            </h3>
            {!userAddress ? (
              <div className="bg-navy-900 rounded-xl p-4 text-sm text-gray-500 text-center border border-navy-600">
                Connect wallet to view your position.
              </div>
            ) : isLoading ? (
              <div className="bg-navy-900 rounded-xl p-4 text-sm text-gray-400 text-center border border-navy-600 flex items-center justify-center gap-2">
                <span className="css-spinner-sm" />
                Loading position...
              </div>
            ) : userPosition ? (
              <div className="bg-navy-900 rounded-xl p-4 border border-navy-600">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">YES Bet</div>
                    <div className="text-emerald-400 font-mono text-lg">
                      {userPosition.yesAmount > 0n
                        ? formatCredits(userPosition.yesAmount)
                        : "-"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">NO Bet</div>
                    <div className="text-rose-400 font-mono text-lg">
                      {userPosition.noAmount > 0n
                        ? formatCredits(userPosition.noAmount)
                        : "-"}
                    </div>
                  </div>
                </div>
                {totalPool > 0n && (
                  <div className="text-xs text-gray-500 text-center mt-3">
                    Your share:{" "}
                    {(
                      Number(
                        ((userPosition.yesAmount + userPosition.noAmount) *
                          10000n) /
                          totalPool
                      ) / 100
                    ).toFixed(1)}
                    % of pool
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-navy-900 rounded-xl p-4 text-sm text-gray-500 text-center border border-navy-600">
                No position in this market.
              </div>
            )}
          </section>

          {/* Privacy Notice (replaces On-Chain Ledger) */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Bet Privacy
            </h3>
            <div className="bg-navy-900 rounded-xl p-4 border border-navy-600">
              <div className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">
                    All bets in this market are anonymous. Your wallet address is
                    never linked to a bet on-chain. Direction and amount are public.
                  </p>
                  <p className="text-xs text-gray-500">
                    Pool totals, bet direction, and outcomes are public. Your identity
                    as a bettor is private — only you can prove you placed a bet via your encrypted record.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-navy-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-xl text-white text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
