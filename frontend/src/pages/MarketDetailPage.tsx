import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useQuery } from "@tanstack/react-query";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BetModal } from "../components/BetModal";
import { ClaimModal } from "../components/ClaimModal";
import { RefundModal } from "../components/RefundModal";
import { ResolveModal } from "../components/OracleResolveModal";
import {
  formatCredits,
  formatPool,
  MarketStatus,
  getMarketData,
  type MarketData,
  getLatestHeight,
  getMappingValue,
} from "../lib/aleo";
import { PoolHistoryChart } from "../components/PoolHistoryChart";
import { CommitBetModal } from "../components/CommitBetModal";
import { RevealBetModal } from "../components/RevealBetModal";
import { CommitRevealStatus } from "../components/CommitRevealStatus";
import { useMarkets, type DisplayMarket } from "../hooks/useMarkets";
import {
  useUserPositions,
  type OnChainPosition,
} from "../hooks/useUserPositions";

type ModalType = "bet" | "claim" | "refund" | "resolve" | "commit" | "reveal";

const STATUS_TO_NUM: Record<string, (typeof MarketStatus)[keyof typeof MarketStatus]> = {
  open: MarketStatus.OPEN,
  closed: MarketStatus.CLOSED,
  resolved: MarketStatus.RESOLVED,
  cancelled: MarketStatus.CANCELLED,
};

function displayToMarketData(dm: DisplayMarket): MarketData {
  return {
    id: dm.id,
    status: STATUS_TO_NUM[dm.status] ?? MarketStatus.OPEN,
    yesPool: BigInt(dm.yesPool),
    noPool: BigInt(dm.noPool),
    outcome: dm.outcome,
    endTime: dm.endTime,
    paused: dm.paused,
  };
}

/**
 * Detail page for a single prediction market. Displays probability bars,
 * pool sizes, market info, privacy disclosure, user positions, and action
 * buttons. Fetches both cached Supabase data and precise on-chain state.
 */
export function MarketDetailPage() {
  const { marketId } = useParams<{ marketId: string }>();
  const { connected } = useWallet();
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [marketId]);

  // Load all markets (uses cache from listing page)
  const { data: markets, refetch } = useMarkets();
  const market = markets?.find((m) => m.id === marketId) ?? null;

  // Fetch chain data for precise pool amounts (once, refresh on modal close)
  const { data: chainData, refetch: refetchChain } = useQuery({
    queryKey: ["chainMarket", marketId],
    queryFn: () => getMarketData(marketId!),
    enabled: !!marketId,
    staleTime: 60_000,
  });

  // User positions (auto-fetches on mount)
  const { data: positions = [], isLoading: positionsLoading, hasFetched: positionsFetched, refetch: refetchPositions } = useUserPositions(
    marketId ? [marketId] : []
  );
  const userPosition: OnChainPosition | null =
    positions.find((p) => p.marketId === marketId) ?? null;

  // Use chain data when available, otherwise fall back to display data
  const effectiveChainData = chainData ?? (market ? displayToMarketData(market) : null);

  // Commit-reveal phase data
  const { data: commitRevealData } = useQuery({
    queryKey: ["commitReveal", marketId],
    queryFn: async () => {
      if (!marketId) return null;
      const [enabledRaw, deadlineRaw, currentHeight] = await Promise.all([
        getMappingValue("commit_reveal_enabled", marketId),
        getMappingValue("reveal_deadline", marketId),
        getLatestHeight(),
      ]);
      const enabled = enabledRaw === "true";
      const revealDeadline = deadlineRaw ? parseInt(deadlineRaw.replace(/u\d+$/, "")) : undefined;
      return { enabled, revealDeadline, currentBlock: currentHeight };
    },
    enabled: !!marketId,
    staleTime: 30_000,
  });

  // GSAP entrance animation
  useGSAP(() => {
    if (!market) return;
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    tl.from(".detail-header", { opacity: 0, y: 20, duration: 0.4 })
      .from(".detail-section", { opacity: 0, y: 20, duration: 0.4, stagger: 0.08 }, "-=0.2");
  }, { scope: pageRef, dependencies: [market?.id] });

  const handleModalClose = () => {
    setActiveModal(null);
    refetch();
    refetchChain();
    refetchPositions();
  };

  if (!marketId) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-gray-400">Market not found.</p>
        <Link to="/" className="text-accent hover:text-accent-light mt-4 inline-block">
          Back to markets
        </Link>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <span className="css-spinner" />
        <p className="text-gray-400 mt-4">Loading market...</p>
      </div>
    );
  }

  const totalPool = market.yesPool + market.noPool;
  const yesPercent = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noPercent = 100 - yesPercent;
  const totalPoolFormatted = formatPool(BigInt(totalPool));

  const isOpen = market.status === "open" && !market.paused;
  const isResolved = market.status === "resolved";
  const isCancelled = market.status === "cancelled";
  const isPaused = market.status === "open" && market.paused;

  const statusConfig = {
    open: { label: "OPEN", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    closed: { label: "CLOSED", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    resolved: { label: "RESOLVED", dot: "bg-slate-400", text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
    cancelled: { label: "CANCELLED", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  } as const;

  const statusKey = isPaused ? "closed" : market.status;
  const cfg = statusConfig[statusKey];
  const displayStatus = isPaused ? "PAUSED" : cfg.label;

  return (
    <div ref={pageRef} className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
      {/* Back link */}
      <Link
        to="/"
        className="detail-header inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4 sm:mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        All Markets
      </Link>

      {/* Market Header */}
      <div className="detail-header mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <span className={`text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold uppercase tracking-wider border-2 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-sm ${cfg.dot}`} />
            {displayStatus}
          </span>
          {market.endDate && (
            <span className="text-xs text-gray-500 font-mono">{market.endDate}</span>
          )}
          <span className="text-xs text-gray-600 font-mono sm:ml-auto">ID: {market.id}</span>
        </div>

        <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl text-white leading-tight mb-2 sm:mb-3">
          {market.question}
        </h1>

        {market.description && (
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            {market.description}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Probability Display */}
          <div className="detail-section glass-card p-4 sm:p-6">
            <div className="flex items-baseline justify-between mb-3 sm:mb-4">
              <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">Probability</h2>
              <span className="text-[11px] sm:text-xs text-gray-600 font-mono">{totalPoolFormatted} credits in pool</span>
            </div>

            {/* Large probability display */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
              <div className="text-center py-3 sm:py-4 rounded-md bg-emerald-500/8 border-2 border-emerald-500/15">
                <div className="font-heading text-2xl sm:text-4xl text-emerald-400 mb-1">{yesPercent.toFixed(1)}%</div>
                <div className="text-xs sm:text-sm text-emerald-400/70 font-bold">Yes</div>
              </div>
              <div className="text-center py-3 sm:py-4 rounded-md bg-rose-500/8 border-2 border-rose-500/15">
                <div className="font-heading text-2xl sm:text-4xl text-rose-400 mb-1">{noPercent.toFixed(1)}%</div>
                <div className="text-xs sm:text-sm text-rose-400/70 font-bold">No</div>
              </div>
            </div>

            {/* Pool bar */}
            <div className="h-3 bg-navy-700 rounded-sm overflow-hidden flex mb-3">
              <div className="pool-bar-yes transition-all" style={{ width: `${yesPercent}%` }} />
              <div className="pool-bar-no transition-all" style={{ width: `${noPercent}%` }} />
            </div>

            <div className="flex justify-between text-xs text-gray-500 font-mono">
              <span>YES: {formatPool(BigInt(market.yesPool))} credits</span>
              <span>NO: {formatPool(BigInt(market.noPool))} credits</span>
            </div>
          </div>

          {/* Pool History Chart */}
          <div className="detail-section glass-card p-4 sm:p-6">
            <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">
              Probability Over Time
            </h2>
            <PoolHistoryChart marketId={marketId} />
          </div>

          {/* Resolved outcome banner */}
          {isResolved && market.outcome !== undefined && (
            <div className={`detail-section py-4 px-5 rounded-md text-center font-bold border-2 ${
              market.outcome
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>
              <div className="text-lg">Resolved: {market.outcome ? "YES" : "NO"} won</div>
            </div>
          )}

          {/* Cancelled banner */}
          {isCancelled && (
            <div className="detail-section py-4 px-5 rounded-md text-center font-bold bg-amber-500/10 text-amber-400 border-2 border-amber-500/20">
              Market Cancelled — refunds available
            </div>
          )}

          {/* Market Info */}
          <div className="detail-section glass-card p-4 sm:p-6">
            <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">Market Info</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Volume</span>
                <span className="text-white font-mono">{formatCredits(BigInt(totalPool))} credits</span>
              </div>
              {market.endTime && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">End Block</span>
                  <span className="text-white font-mono">#{market.endTime.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">End Date</span>
                <span className="text-white">{market.endDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={cfg.text}>{displayStatus}</span>
              </div>
            </div>
          </div>

          {/* Privacy Disclosure */}
          <div className="detail-section glass-card p-4 sm:p-6">
            <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Privacy Disclosure
              </span>
            </h2>
          </div>
        </div>

        {/* Right Column: Actions sidebar */}
        <div className="space-y-6">
          {/* Bet Actions */}
          {isOpen && connected && (
            <div className="detail-section glass-card p-4 sm:p-5">
              <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">Place a Bet</h3>
              <div className="space-y-3">
                <button
                  onClick={() => { setSelectedOutcome("yes"); setActiveModal("bet"); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-emerald-500/10 border-2 border-emerald-500/15 hover:border-emerald-500/40 transition-colors group"
                >
                  <span className="text-emerald-400 font-bold">Yes</span>
                  <span className="text-emerald-400 font-mono font-bold group-hover:text-emerald-300">
                    {yesPercent.toFixed(0)}%
                  </span>
                </button>
                <button
                  onClick={() => { setSelectedOutcome("no"); setActiveModal("bet"); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-rose-500/10 border-2 border-rose-500/15 hover:border-rose-500/40 transition-colors group"
                >
                  <span className="text-rose-400 font-bold">No</span>
                  <span className="text-rose-400 font-mono font-bold group-hover:text-rose-300">
                    {noPercent.toFixed(0)}%
                  </span>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-privacy/60">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Your bet is encrypted via ZK proof
              </div>

              {/* Commit-reveal option */}
              <div className="mt-3 pt-3 border-t border-navy-600">
                <p className="text-[11px] text-gray-500 mb-2">
                  Or use commit-reveal for extra privacy:
                </p>
                <button
                  onClick={() => setActiveModal("commit")}
                  className="w-full py-2 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:border-violet-500/40 text-sm font-bold transition-colors"
                >
                  🔒 Private Commit Bet
                </button>
              </div>
            </div>
          )}

          {/* Reveal phase button */}
          {connected && commitRevealData?.enabled && market.status === "closed" && (
            <div className="detail-section glass-card p-4 sm:p-5">
              <CommitRevealStatus
                commitRevealEnabled={true}
                marketStatus="closed"
                revealDeadline={commitRevealData.revealDeadline}
                currentBlock={commitRevealData.currentBlock}
                endBlock={market.endTime}
              />
              <button
                onClick={() => setActiveModal("reveal")}
                className="w-full mt-3 py-3 rounded-md bg-amber-500/10 text-amber-400 border-2 border-amber-500/20 hover:border-amber-500/40 text-sm font-bold transition-colors"
              >
                🔓 Reveal Committed Bets
              </button>
            </div>
          )}

          {/* Connect wallet prompt */}
          {isOpen && !connected && (
            <div className="detail-section glass-card p-4 sm:p-5 text-center">
              <p className="text-gray-400 text-sm mb-3">Connect wallet to place bets</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-emerald-500/10 border-2 border-emerald-500/15">
                  <span className="text-emerald-400 text-sm font-bold">Yes</span>
                  <span className="text-emerald-400 font-mono text-sm font-bold">{yesPercent.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-rose-500/10 border-2 border-rose-500/15">
                  <span className="text-rose-400 text-sm font-bold">No</span>
                  <span className="text-rose-400 font-mono text-sm font-bold">{noPercent.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Paused */}
          {isPaused && (
            <div className="detail-section glass-card p-4 sm:p-5 text-center">
              <div className="text-sm text-gray-400">Betting Paused</div>
            </div>
          )}

          {/* Resolve */}
          {market.status === "closed" && (
            <div className="detail-section">
              <button
                onClick={() => setActiveModal("resolve")}
                className="w-full py-3 rounded-md bg-accent/10 text-accent border-2 border-accent/20 hover:border-accent/40 text-sm font-bold transition-colors"
              >
                Resolve Market
              </button>
            </div>
          )}

          {/* Claim */}
          {isResolved && userPosition && (
            <div className="detail-section">
              <button
                onClick={() => setActiveModal("claim")}
                className="w-full py-3 rounded-md bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/20 hover:border-emerald-500/40 text-sm font-bold transition-colors"
              >
                Claim Winnings
              </button>
            </div>
          )}

          {/* Refund */}
          {isCancelled && userPosition && (
            <div className="detail-section">
              <button
                onClick={() => setActiveModal("refund")}
                className="w-full py-3 rounded-md bg-amber-500/10 text-amber-400 border-2 border-amber-500/20 hover:border-amber-500/40 text-sm font-bold transition-colors"
              >
                Claim Refund
              </button>
            </div>
          )}

          {/* Your Position */}
          {connected && (
            <div className="detail-section glass-card p-4 sm:p-5">
              <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">Your Position</h3>
              {positionsLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center py-3 rounded-md bg-navy-900 border-2 border-navy-600 animate-pulse">
                      <div className="text-xs text-gray-500 mb-1">YES</div>
                      <div className="h-6 bg-navy-700 rounded mx-4" />
                    </div>
                    <div className="text-center py-3 rounded-md bg-navy-900 border-2 border-navy-600 animate-pulse">
                      <div className="text-xs text-gray-500 mb-1">NO</div>
                      <div className="h-6 bg-navy-700 rounded mx-4" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 text-center">Loading positions from wallet…</p>
                </div>
              ) : userPosition ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center py-3 rounded-md bg-navy-900 border-2 border-navy-600">
                      <div className="text-xs text-gray-500 mb-1">YES</div>
                      <div className="text-emerald-400 font-mono text-lg font-bold">
                        {userPosition.yesAmount > 0n ? formatCredits(userPosition.yesAmount) : "-"}
                      </div>
                    </div>
                    <div className="text-center py-3 rounded-md bg-navy-900 border-2 border-navy-600">
                      <div className="text-xs text-gray-500 mb-1">NO</div>
                      <div className="text-rose-400 font-mono text-lg font-bold">
                        {userPosition.noAmount > 0n ? formatCredits(userPosition.noAmount) : "-"}
                      </div>
                    </div>
                  </div>
                  {BigInt(totalPool) > 0n && (
                    <div className="text-xs text-gray-500 text-center">
                      Your share:{" "}
                      {(
                        Number(
                          ((userPosition.yesAmount + userPosition.noAmount) * 10000n) /
                            BigInt(totalPool)
                        ) / 100
                      ).toFixed(1)}
                      % of pool
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center">
                  {positionsFetched ? "No position in this market." : "Connect wallet to view positions."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {activeModal === "bet" && (
        <BetModal
          market={market}
          isOpen={true}
          onClose={handleModalClose}
          onBetPlaced={() => refetchPositions()}
          initialOutcome={selectedOutcome}
        />
      )}

      {activeModal === "claim" &&
        market.outcome !== undefined &&
        effectiveChainData && (
          <ClaimModal
            marketId={market.id}
            question={market.question}
            yesPool={effectiveChainData.yesPool}
            noPool={effectiveChainData.noPool}
            winningOutcome={market.outcome}
            userPosition={userPosition}
            isOpen={true}
            onClose={handleModalClose}
            onClaimed={() => refetchPositions()}
          />
        )}

      {activeModal === "refund" && (
        <RefundModal
          marketId={market.id}
          question={market.question}
          userPosition={userPosition}
          isOpen={true}
          onClose={handleModalClose}
          onRefunded={() => refetchPositions()}
        />
      )}

      {activeModal === "resolve" && effectiveChainData && (
        <ResolveModal
          marketId={market.id}
          question={market.question}
          yesPool={effectiveChainData.yesPool}
          noPool={effectiveChainData.noPool}
          oracleEnabled={effectiveChainData.oracleEnabled}
          isOpen={true}
          onClose={handleModalClose}
          onResolved={() => {
            refetch();
            refetchPositions();
          }}
        />
      )}

      {activeModal === "commit" && (
        <CommitBetModal
          market={market}
          isOpen={true}
          onClose={handleModalClose}
          onCommitted={() => refetchPositions()}
        />
      )}

      {activeModal === "reveal" && (
        <RevealBetModal
          marketId={market.id}
          question={market.question}
          isOpen={true}
          onClose={handleModalClose}
          onRevealed={() => refetchPositions()}
        />
      )}
    </div>
  );
}
