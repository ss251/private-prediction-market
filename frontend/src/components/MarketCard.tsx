import { Link } from "react-router-dom";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
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
  onBet: (outcome: "yes" | "no") => void;
  onClaim?: () => void;
  onRefund?: () => void;
  onResolve?: () => void;
  userPosition?: OnChainPosition | null;
}

const statusConfig = {
  open: { label: "OPEN", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  closed: { label: "CLOSED", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  resolved: { label: "RESOLVED", dot: "bg-slate-400", text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  cancelled: { label: "CANCELLED", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
} as const;

/**
 * Card component for displaying a single prediction market.
 * Shows question, probability bars, pool size, status badge, and action buttons
 * (bet, claim, refund, resolve) based on market state and wallet connection.
 */
export function MarketCard({ market, onBet, onClaim, onRefund, onResolve, userPosition }: MarketCardProps) {
  const { connected } = useWallet();
  const totalPool = market.yesPool + market.noPool;
  const yesPercent = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noPercent = 100 - yesPercent;
  const totalPoolFormatted = formatPool(BigInt(totalPool));

  const displayStatus = market.paused && market.status === "open" ? "PAUSED" : undefined;
  const statusKey = market.paused && market.status === "open" ? "closed" : market.status;
  const cfg = statusConfig[statusKey];

  const isOpen = market.status === "open" && !market.paused;
  const isResolved = market.status === "resolved";
  const isCancelled = market.status === "cancelled";

  return (
    <div className="glass-card p-4 sm:p-5 h-full flex flex-col">
      {/* Header: status + end date */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1.5 font-bold uppercase tracking-wider border-2 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <span className={`w-1.5 h-1.5 rounded-sm ${cfg.dot}`} />
          {displayStatus ?? cfg.label}
        </span>
        {market.endDate && (
          <span className="text-[11px] text-gray-600 font-mono">
            {market.endDate}
          </span>
        )}
      </div>

      {/* Question — links to detail page */}
      <Link to={`/market/${market.id}`} className="group">
        <h3 className="font-heading text-base text-white mb-4 leading-snug group-hover:text-accent transition-colors">
          {market.question}
        </h3>
      </Link>

      {/* Resolved outcome banner */}
      {isResolved && market.outcome !== undefined && (
        <div className={`mb-3 py-2 px-3 rounded-md text-center font-bold text-sm border-2 ${
          market.outcome
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        }`}>
          Resolved: {market.outcome ? "YES" : "NO"} won
        </div>
      )}

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="mb-3 py-2 px-3 rounded-md text-center font-bold text-sm bg-amber-500/10 text-amber-400 border-2 border-amber-500/20">
          Market Cancelled
        </div>
      )}

      {/* Spacer to push action area to bottom */}
      <div className="mt-auto" />

      {/* YES / NO buttons — the hero interaction */}
      {isOpen && connected && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => onBet("yes")}
            className="flex items-center justify-center px-3 py-2.5 rounded-md bg-emerald-500/10 border-2 border-emerald-500/15 hover:border-emerald-500/40 transition-colors group"
          >
            <span className="text-emerald-400 text-sm font-bold">Bet Yes</span>
          </button>
          <button
            onClick={() => onBet("no")}
            className="flex items-center justify-center px-3 py-2.5 rounded-md bg-rose-500/10 border-2 border-rose-500/15 hover:border-rose-500/40 transition-colors group"
          >
            <span className="text-rose-400 text-sm font-bold">Bet No</span>
          </button>
        </div>
      )}

      {/* Static display (when not open or not connected) */}
      {(!isOpen || !connected) && !isResolved && !isCancelled && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {isOpen ? (
            <>
              <div className="flex items-center justify-center px-3 py-2.5 rounded-md bg-emerald-500/10 border-2 border-emerald-500/15">
                <span className="text-emerald-400 text-sm font-bold">Yes</span>
              </div>
              <div className="flex items-center justify-center px-3 py-2.5 rounded-md bg-rose-500/10 border-2 border-rose-500/15">
                <span className="text-rose-400 text-sm font-bold">No</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-emerald-500/10 border-2 border-emerald-500/15">
                <span className="text-emerald-400 text-sm font-bold">Yes</span>
                <span className="text-emerald-400 font-mono text-sm font-bold">{yesPercent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-rose-500/10 border-2 border-rose-500/15">
                <span className="text-rose-400 text-sm font-bold">No</span>
                <span className="text-rose-400 font-mono text-sm font-bold">{noPercent.toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Paused state */}
      {market.status === "open" && market.paused && (
        <div className="mb-3 py-2 px-3 rounded-md text-center text-sm text-gray-400 bg-navy-700 border-2 border-navy-600">
          Betting Paused
        </div>
      )}

      {/* Action buttons for non-open states */}
      {market.status === "closed" && (
        <button
          onClick={onResolve}
          className="mb-3 w-full py-2 rounded-md bg-accent/10 text-accent border-2 border-accent/20 hover:border-accent/40 text-sm font-bold transition-colors"
        >
          Resolve Market
        </button>
      )}

      {isResolved && userPosition && (
        <button
          onClick={onClaim}
          className="mb-3 w-full py-2 rounded-md bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/20 hover:border-emerald-500/40 text-sm font-bold transition-colors"
        >
          Claim Winnings
        </button>
      )}

      {isCancelled && userPosition && (
        <button
          onClick={onRefund}
          className="mb-3 w-full py-2 rounded-md bg-amber-500/10 text-amber-400 border-2 border-amber-500/20 hover:border-amber-500/40 text-sm font-bold transition-colors"
        >
          Claim Refund
        </button>
      )}

      {/* Footer: privacy badge + pool (if revealed) + details link */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-navy-600">
        <div className="flex items-center gap-1.5 text-[11px] text-privacy/60">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {isOpen ? (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Pool hidden
            </span>
          ) : (
            "Anonymous"
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-600">
          {!isOpen && <span className="font-mono">{totalPoolFormatted} credits</span>}
          <Link
            to={`/market/${market.id}`}
            className="text-accent-light hover:text-accent transition-colors font-medium"
          >
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
