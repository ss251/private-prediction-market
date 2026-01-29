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
  bettorCount?: number;
  paused?: boolean;
  endTime?: number;
  oracleEnabled?: boolean;
}

interface MarketCardProps {
  market: Market;
  onBet: () => void;
  onClaim?: () => void;
  onRefund?: () => void;
  onViewHistory?: () => void;
  onOracleResolve?: () => void;
  userPosition?: OnChainPosition | null;
}

export function MarketCard({ market, onBet, onClaim, onRefund, onViewHistory, onOracleResolve, userPosition }: MarketCardProps) {
  const { connected } = useWallet();
  const totalPool = market.yesPool + market.noPool;
  const yesPercent = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noPercent = 100 - yesPercent;

  // Format pool values for display
  const yesPoolFormatted = formatPool(BigInt(market.yesPool));
  const noPoolFormatted = formatPool(BigInt(market.noPool));
  const totalPoolFormatted = formatPool(BigInt(totalPool));

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex-1">
          {market.question}
        </h3>
        <div className="flex items-center gap-2 ml-2">
          {market.oracleEnabled && (
            <span className="text-xs px-2 py-1 rounded bg-purple-900/50 text-purple-400 border border-purple-700 whitespace-nowrap">
              ORACLE
            </span>
          )}
          {market.paused && (
            <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700 whitespace-nowrap">
              PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Pool visualization */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-green-400">YES {yesPercent.toFixed(1)}%</span>
          <span className="text-red-400">NO {noPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${yesPercent}%` }}
          />
          <div
            className="bg-red-500 transition-all"
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
          className={`mb-4 p-2 rounded text-center font-bold ${
            market.outcome
              ? "bg-green-900/50 text-green-400"
              : "bg-red-900/50 text-red-400"
          }`}
        >
          Resolved: {market.outcome ? "YES" : "NO"} won
        </div>
      )}

      {/* Cancelled notice */}
      {market.status === "cancelled" && (
        <div className="mb-4 p-2 rounded text-center font-bold bg-yellow-900/50 text-yellow-400">
          Market Cancelled
        </div>
      )}

      {/* Status and action */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm px-2 py-1 rounded ${
              market.status === "open"
                ? market.paused
                  ? "bg-yellow-900/50 text-yellow-400"
                  : "bg-green-900/50 text-green-400"
                : market.status === "closed"
                  ? "bg-yellow-900/50 text-yellow-400"
                  : market.status === "cancelled"
                    ? "bg-red-900/50 text-red-400"
                    : "bg-gray-700 text-gray-400"
            }`}
          >
            {market.paused && market.status === "open"
              ? "PAUSED"
              : market.status.toUpperCase()}
          </span>
          {market.bettorCount !== undefined && market.bettorCount > 0 && (
            <span className="text-xs text-gray-500">
              {market.bettorCount} bettor{market.bettorCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {market.status === "open" && !market.paused && (
            <button
              onClick={onBet}
              disabled={!connected}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {connected ? "Place Bet" : "Connect Wallet"}
            </button>
          )}

          {market.status === "open" && market.paused && (
            <span className="px-4 py-2 bg-gray-700 rounded-lg text-gray-400 font-medium">
              Betting Paused
            </span>
          )}

          {market.status === "closed" && market.oracleEnabled && (
            <button
              onClick={onOracleResolve}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
            >
              Resolve (Oracle)
            </button>
          )}

          {market.status === "resolved" && userPosition && !userPosition.claimed && (
            <button
              onClick={onClaim}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors"
            >
              Claim Winnings
            </button>
          )}

          {market.status === "resolved" && (!userPosition || userPosition.claimed) && (
            <span className="px-4 py-2 bg-gray-700 rounded-lg text-gray-400 text-sm">
              {userPosition?.claimed ? "Claimed" : "Resolved"}
            </span>
          )}

          {market.status === "cancelled" && userPosition && !userPosition.claimed && (
            <button
              onClick={onRefund}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              Claim Refund
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-3">
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
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
