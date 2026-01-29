import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { formatPool } from "../lib/aleo";
import type { OnChainPosition } from "../hooks/useUserPositions";

interface Market {
  id: string;
  question: string;
  yesPool: number;
  noPool: number;
  status: "open" | "closed" | "resolved" | "cancelled";
  endDate: string;
  outcome?: boolean;
  paused?: boolean;
  endTime?: number;
}

interface MarketCardProps {
  market: Market;
  onBet: () => void;
  onClaim?: () => void;
  onRefund?: () => void;
  onViewHistory?: () => void;
  onResolve?: () => void;
  userPosition?: OnChainPosition | null;
}

const statusStyles = {
  open: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  closed: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  resolved: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  cancelled: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
} as const;

const dotStyles = {
  open: "bg-emerald-400",
  closed: "bg-amber-400",
  resolved: "bg-slate-400",
  cancelled: "bg-rose-400",
} as const;

export function MarketCard({ market, onBet, onClaim, onRefund, onViewHistory, onResolve, userPosition }: MarketCardProps) {
  const { connected } = useWallet();
  const totalPool = market.yesPool + market.noPool;
  const yesPercent = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noPercent = 100 - yesPercent;

  const yesPoolFormatted = formatPool(BigInt(market.yesPool));
  const noPoolFormatted = formatPool(BigInt(market.noPool));
  const totalPoolFormatted = formatPool(BigInt(totalPool));

  const displayStatus = market.paused && market.status === "open" ? "PAUSED" : market.status.toUpperCase();
  const statusKey = market.paused && market.status === "open" ? "closed" : market.status;

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-heading text-lg font-semibold text-white flex-1">
          {market.question}
        </h3>
        <div className="flex items-center gap-2 ml-2">
          {market.paused && market.status === "open" && (
            <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
              PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Pool visualization */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-emerald-400 font-medium">YES {yesPercent.toFixed(1)}%</span>
          <span className="text-rose-400 font-medium">NO {noPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-navy-700 rounded-full overflow-hidden flex">
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

      {/* Pool totals */}
      <div className="flex justify-between text-sm text-gray-400 mb-4">
        <span>YES: {yesPoolFormatted}</span>
        <span>NO: {noPoolFormatted}</span>
      </div>

      {/* Resolved outcome */}
      {market.status === "resolved" && market.outcome !== undefined && (
        <div
          className={`mb-4 p-2.5 rounded-xl text-center font-bold text-sm ${
            market.outcome
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}
        >
          Resolved: {market.outcome ? "YES" : "NO"} won
        </div>
      )}

      {/* Cancelled notice */}
      {market.status === "cancelled" && (
        <div className="mb-4 p-2.5 rounded-xl text-center font-bold text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Market Cancelled
        </div>
      )}

      {/* Status and action */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${statusStyles[statusKey]}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[statusKey]}`} />
            {displayStatus}
          </span>
        </div>

        <div className="flex gap-2">
          {market.status === "open" && !market.paused && (
            <button
              onClick={onBet}
              disabled={!connected}
              className="btn-primary px-4 py-2 rounded-xl text-sm"
            >
              {connected ? "Place Bet" : "Connect Wallet"}
            </button>
          )}

          {market.status === "open" && market.paused && (
            <span className="px-4 py-2 bg-navy-700 rounded-xl text-gray-400 text-sm font-medium">
              Betting Paused
            </span>
          )}

          {market.status === "closed" && (
            <button
              onClick={onResolve}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-white text-sm font-medium transition-colors"
            >
              Resolve
            </button>
          )}

          {market.status === "resolved" && userPosition && (
            <button
              onClick={onClaim}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white text-sm font-medium transition-colors"
            >
              Claim Winnings
            </button>
          )}

          {market.status === "resolved" && !userPosition && (
            <span className="px-4 py-2 bg-navy-700 rounded-xl text-gray-400 text-sm">
              Resolved
            </span>
          )}

          {market.status === "cancelled" && userPosition && (
            <button
              onClick={onRefund}
              className="btn-primary px-4 py-2 rounded-xl text-sm"
            >
              Claim Refund
            </button>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-navy-600">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">Ends: {market.endDate}</p>
          {market.endTime && (
            <p className="text-xs text-gray-600">
              (block #{market.endTime.toLocaleString()})
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500">Pool: {totalPoolFormatted} credits</p>
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="text-xs text-accent-light hover:text-accent transition-colors"
            >
              Details
            </button>
          )}
        </div>
      </div>

      {/* Privacy footer */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-privacy/70">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Private bets on Aleo — your position is encrypted
      </div>
    </div>
  );
}
