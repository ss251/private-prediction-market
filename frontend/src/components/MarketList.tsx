import { useState, useRef } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MarketCard } from "./MarketCard";
import { BetModal } from "./BetModal";
import { ClaimModal } from "./ClaimModal";
import { RefundModal } from "./RefundModal";
import { ResolveModal } from "./OracleResolveModal";
import { CreateMarketModal } from "./CreateMarketModal";
import {
  getAllMarketIds,
  getMarkets,
  type MarketData,
} from "../lib/aleo";
import {
  useUserPositions,
  type OnChainPosition,
} from "../hooks/useUserPositions";
import { useMarkets, type DisplayMarket } from "../hooks/useMarkets";

type ModalType = "bet" | "claim" | "refund" | "resolve" | "create";

export function MarketList() {
  const { connected } = useWallet();
  const [selectedMarket, setSelectedMarket] = useState<DisplayMarket | null>(
    null
  );
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  // Store raw chain data for claim calculations
  const [chainMarkets, setChainMarkets] = useState<MarketData[]>([]);

  // Single-query market loading with Supabase + chain fallback + Realtime
  const {
    data: markets,
    isLoading,
    error,
    refetch,
  } = useMarkets();

  // Discover market IDs for user positions + chain data (needed for claims)
  const { data: marketIds = [] } = useQuery({
    queryKey: ["marketIds"],
    queryFn: getAllMarketIds,
    refetchInterval: 60_000,
  });

  // Fetch raw chain data for claim calculations (pools must be precise)
  useQuery({
    queryKey: ["chainMarkets", marketIds],
    queryFn: async () => {
      if (marketIds.length === 0) return [];
      const raw = await getMarkets(marketIds);
      setChainMarkets(raw);
      return raw;
    },
    enabled: marketIds.length > 0,
    refetchInterval: 30_000,
  });

  // Fetch user positions for all discovered markets
  const {
    data: positions = [],
    refetch: refetchPositions,
  } = useUserPositions(marketIds);

  const getPositionForMarket = (
    marketId: string
  ): OnChainPosition | null => {
    return positions.find((p) => p.marketId === marketId) ?? null;
  };

  const handleBet = (market: DisplayMarket) => {
    setSelectedMarket(market);
    setActiveModal("bet");
  };

  const handleClaim = (market: DisplayMarket) => {
    setSelectedMarket(market);
    setActiveModal("claim");
  };

  const handleRefund = (market: DisplayMarket) => {
    setSelectedMarket(market);
    setActiveModal("refund");
  };

  const handleResolve = (market: DisplayMarket) => {
    setSelectedMarket(market);
    setActiveModal("resolve");
  };

  const handleModalClose = () => {
    setActiveModal(null);
    refetch();
    refetchPositions();
  };

  const handleBetPlaced = () => {
    refetchPositions();
  };

  const handleClaimed = () => {
    refetchPositions();
  };

  const handleRefunded = () => {
    refetchPositions();
  };

  // GSAP stagger animation for market cards
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!markets || markets.length === 0) return;

    gsap.from(".market-card-item", {
      opacity: 0,
      y: 30,
      duration: 0.5,
      stagger: 0.08,
      ease: "power2.out",
    });

    gsap.from(".market-header", {
      opacity: 0,
      x: -20,
      duration: 0.4,
      ease: "power2.out",
    });
  }, { scope: sectionRef, dependencies: [markets?.length] });

  // Get chain data for claim modal
  const selectedChainMarket = selectedMarket
    ? chainMarkets.find((m) => m.id === selectedMarket.id)
    : null;

  const selectedPosition = selectedMarket
    ? getPositionForMarket(selectedMarket.id)
    : null;

  return (
    <div ref={sectionRef}>
      <div className="market-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-white">Active Markets</h2>
          {isLoading && (
            <span className="text-sm text-gray-400 animate-pulse">
              Loading...
            </span>
          )}
          {error && (
            <span className="text-sm text-yellow-500">Using cached data</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {connected && (
            <button
              onClick={() => setActiveModal("create")}
              className="btn-primary px-4 py-2 rounded-lg text-sm"
            >
              + Create Market
            </button>
          )}
          {!connected && (
            <p className="text-gray-400 text-sm">
              Connect wallet to place bets
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {(markets ?? []).map((market) => {
          const position = getPositionForMarket(market.id);

          return (
            <div key={market.id} className="market-card-item">
            <MarketCard
              market={market}
              onBet={() => handleBet(market)}
              onClaim={() => handleClaim(market)}
              onRefund={() => handleRefund(market)}
              onResolve={() => handleResolve(market)}
              userPosition={position}
            />
            </div>
          );
        })}
      </div>

      {markets?.length === 0 && !isLoading && (
        <div className="text-center text-gray-400 py-12">
          <p>No active markets found.</p>
          <p className="text-sm mt-2">
            Markets will appear here once they are created on-chain.
          </p>
        </div>
      )}

      {/* Create Market Modal (admin only) */}
      {activeModal === "create" && (
        <CreateMarketModal
          isOpen={true}
          onClose={handleModalClose}
          onCreated={() => {
            refetch();
          }}
        />
      )}

      {/* Bet Modal */}
      {selectedMarket && activeModal === "bet" && (
        <BetModal
          market={selectedMarket}
          isOpen={true}
          onClose={handleModalClose}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {/* Claim Modal */}
      {selectedMarket &&
        activeModal === "claim" &&
        selectedMarket.outcome !== undefined && (
          <ClaimModal
            marketId={selectedMarket.id}
            question={selectedMarket.question}
            yesPool={
              selectedChainMarket?.yesPool ?? BigInt(selectedMarket.yesPool)
            }
            noPool={
              selectedChainMarket?.noPool ?? BigInt(selectedMarket.noPool)
            }
            winningOutcome={selectedMarket.outcome}
            userPosition={selectedPosition}
            isOpen={true}
            onClose={handleModalClose}
            onClaimed={handleClaimed}
          />
        )}

      {/* Refund Modal */}
      {selectedMarket && activeModal === "refund" && (
        <RefundModal
          marketId={selectedMarket.id}
          question={selectedMarket.question}
          userPosition={selectedPosition}
          isOpen={true}
          onClose={handleModalClose}
          onRefunded={handleRefunded}
        />
      )}

      {/* Resolve Modal */}
      {selectedMarket &&
        activeModal === "resolve" &&
        (selectedChainMarket || selectedMarket) && (
          <ResolveModal
            marketId={selectedMarket.id}
            question={selectedMarket.question}
            yesPool={selectedChainMarket?.yesPool ?? BigInt(selectedMarket.yesPool)}
            noPool={selectedChainMarket?.noPool ?? BigInt(selectedMarket.noPool)}
            isOpen={true}
            onClose={handleModalClose}
            onResolved={() => {
              refetch();
              refetchPositions();
            }}
          />
        )}
    </div>
  );
}
