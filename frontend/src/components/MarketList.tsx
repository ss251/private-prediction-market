import { useState } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { MarketCard } from "./MarketCard";
import { BetModal } from "./BetModal";
import { ClaimModal } from "./ClaimModal";
import { RefundModal } from "./RefundModal";
import { MarketHistory } from "./MarketHistory";
import { getMarkets, type MarketData, MarketStatus } from "../lib/aleo";
import { useBets } from "../hooks/useBets";

// Known market IDs on testnet (in production, this would come from an indexer or event logs)
// These are the markets that have been created on the deployed contract
const KNOWN_MARKET_IDS = ["1field", "2field"];

// Demo market metadata (questions, end dates - these would be stored off-chain in production)
const MARKET_METADATA: Record<
  string,
  { question: string; endDate: string }
> = {
  "1field": {
    question: "Will Bitcoin reach $150k by end of 2026?",
    endDate: "2026-12-31",
  },
  "2field": {
    question: "Will Aleo mainnet launch before March 2026?",
    endDate: "2026-03-01",
  },
};

// Combine on-chain data with off-chain metadata
interface DisplayMarket {
  id: string;
  question: string;
  yesPool: number;
  noPool: number;
  status: "open" | "closed" | "resolved" | "cancelled";
  endDate: string;
  outcome?: boolean;
  bettorCount: number;
  paused?: boolean;
  endTime?: number;
}

function toDisplayMarket(market: MarketData): DisplayMarket {
  const metadata = MARKET_METADATA[market.id] || {
    question: `Market ${market.id}`,
    endDate: "TBD",
  };

  const statusMap: Record<MarketStatus, DisplayMarket["status"]> = {
    [MarketStatus.OPEN]: "open",
    [MarketStatus.CLOSED]: "closed",
    [MarketStatus.RESOLVED]: "resolved",
    [MarketStatus.CANCELLED]: "cancelled",
  };

  return {
    id: market.id,
    question: metadata.question,
    yesPool: Number(market.yesPool),
    noPool: Number(market.noPool),
    status: statusMap[market.status],
    endDate: metadata.endDate,
    outcome: market.outcome,
    bettorCount: market.bettorCount,
    paused: market.paused,
    endTime: market.endTime,
  };
}

// Fallback demo data when chain is unreachable
const DEMO_MARKETS: DisplayMarket[] = [
  {
    id: "1field",
    question: "Will Bitcoin reach $150k by end of 2026?",
    yesPool: 5000000, // 5 credits in microcredits
    noPool: 3000000,
    status: "open",
    endDate: "2026-12-31",
    bettorCount: 0,
  },
  {
    id: "2field",
    question: "Will Aleo mainnet launch before March 2026?",
    yesPool: 8000000,
    noPool: 2000000,
    status: "open",
    endDate: "2026-03-01",
    bettorCount: 0,
  },
];

type ModalType = "bet" | "claim" | "refund" | "history";

export function MarketList() {
  const { connected, publicKey } = useWallet();
  const [selectedMarket, setSelectedMarket] = useState<DisplayMarket | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const { addBet, getUnclaimedBets, markClaimed, getBetsForMarket } = useBets(publicKey ?? null);

  // Store raw chain data for claim calculations
  const [chainMarkets, setChainMarkets] = useState<MarketData[]>([]);

  // Fetch markets from chain
  const {
    data: markets,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["markets", KNOWN_MARKET_IDS],
    queryFn: async () => {
      const rawMarkets = await getMarkets(KNOWN_MARKET_IDS);
      setChainMarkets(rawMarkets);
      if (rawMarkets.length === 0) {
        // Fall back to demo data if no markets found
        console.log("No markets found on chain, using demo data");
        return DEMO_MARKETS;
      }
      return rawMarkets.map(toDisplayMarket);
    },
    // Refetch every 30 seconds to get updated pool data
    refetchInterval: 30000,
    // Use demo data as fallback
    placeholderData: DEMO_MARKETS,
  });

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

  const handleViewHistory = (market: DisplayMarket) => {
    setSelectedMarket(market);
    setActiveModal("history");
  };

  const handleModalClose = () => {
    setActiveModal(null);
    // Refetch markets after any modal action to show updated pools
    refetch();
  };

  const handleBetPlaced = (marketId: string, outcome: boolean, amount: number, txId: string) => {
    addBet(marketId, outcome, amount, txId);
  };

  const handleClaimed = (txId: string) => {
    // Mark all unclaimed bets for this market as claimed
    if (selectedMarket) {
      const bets = getUnclaimedBets(selectedMarket.id);
      bets.forEach((b) => markClaimed(b.txId));
    }
  };

  const handleRefunded = (txId: string) => {
    if (selectedMarket) {
      const bets = getUnclaimedBets(selectedMarket.id);
      bets.forEach((b) => markClaimed(b.txId));
    }
  };

  // Get chain data for claim modal
  const selectedChainMarket = selectedMarket
    ? chainMarkets.find((m) => m.id === selectedMarket.id)
    : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Active Markets</h2>
          {isLoading && (
            <span className="text-sm text-gray-400 animate-pulse">
              Loading...
            </span>
          )}
          {error && (
            <span className="text-sm text-yellow-500">Using cached data</span>
          )}
        </div>
        {!connected && (
          <p className="text-gray-400 text-sm">Connect wallet to place bets</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(markets || DEMO_MARKETS).map((market) => {
          const userBets = getBetsForMarket(market.id);
          const hasUnclaimedBets = getUnclaimedBets(market.id).length > 0;

          return (
            <MarketCard
              key={market.id}
              market={market}
              onBet={() => handleBet(market)}
              onClaim={() => handleClaim(market)}
              onRefund={() => handleRefund(market)}
              onViewHistory={() => handleViewHistory(market)}
              userHasBets={hasUnclaimedBets}
            />
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
      {selectedMarket && activeModal === "claim" && selectedMarket.outcome !== undefined && (
        <ClaimModal
          marketId={selectedMarket.id}
          question={selectedMarket.question}
          yesPool={selectedChainMarket?.yesPool ?? BigInt(selectedMarket.yesPool)}
          noPool={selectedChainMarket?.noPool ?? BigInt(selectedMarket.noPool)}
          winningOutcome={selectedMarket.outcome}
          bets={getUnclaimedBets(selectedMarket.id)}
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
          bets={getUnclaimedBets(selectedMarket.id)}
          isOpen={true}
          onClose={handleModalClose}
          onRefunded={handleRefunded}
        />
      )}

      {/* Market History Modal */}
      {selectedMarket && activeModal === "history" && (
        <MarketHistory
          marketId={selectedMarket.id}
          question={selectedMarket.question}
          userAddress={publicKey ?? null}
          isOpen={true}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
