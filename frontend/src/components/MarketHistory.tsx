// Market history modal: overview, user on-chain position, bettor ledger

import { useMarketHistory } from "../hooks/useMarketHistory";
import { formatCredits, formatPool, MarketStatus } from "../lib/aleo";

interface MarketHistoryProps {
  marketId: string;
  question: string;
  userAddress: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

const STATUS_LABELS: Record<number, { text: string; className: string }> = {
  [MarketStatus.OPEN]: {
    text: "OPEN",
    className: "bg-green-900/50 text-green-400",
  },
  [MarketStatus.CLOSED]: {
    text: "CLOSED",
    className: "bg-yellow-900/50 text-yellow-400",
  },
  [MarketStatus.RESOLVED]: {
    text: "RESOLVED",
    className: "bg-gray-700 text-gray-400",
  },
  [MarketStatus.CANCELLED]: {
    text: "CANCELLED",
    className: "bg-red-900/50 text-red-400",
  },
};

export function MarketHistory({
  marketId,
  question,
  userAddress,
  isOpen,
  onClose,
}: MarketHistoryProps) {
  const {
    bettors,
    userPosition,
    marketData,
    isLoading,
    isBettorsLoading,
    error,
  } = useMarketHistory(marketId, userAddress, isOpen);

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
        className: "bg-gray-700 text-gray-400",
      }
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div className="flex-1 mr-4">
            <h2 className="text-lg font-semibold text-white">{question}</h2>
            <p className="text-xs text-gray-500 mt-1">Market {marketId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Market Overview */}
          {isLoading ? (
            <div className="text-gray-400 text-sm animate-pulse">
              Loading market data...
            </div>
          ) : marketData ? (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Market Overview
              </h3>
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusInfo && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${statusInfo.className}`}
                    >
                      {statusInfo.text}
                    </span>
                  )}
                  {marketData.paused && (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">
                      PAUSED
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {marketData.bettorCount} bettor
                    {marketData.bettorCount !== 1 ? "s" : ""}
                  </span>
                  {marketData.endTime && (
                    <span className="text-xs text-gray-600">
                      Ends at block #{marketData.endTime.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Pool bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-400">
                      YES {yesPercent.toFixed(1)}%
                    </span>
                    <span className="text-red-400">
                      NO {noPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden flex">
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
                      className={`p-2 rounded text-center text-sm font-bold ${
                        marketData.outcome
                          ? "bg-green-900/50 text-green-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      Resolved: {marketData.outcome ? "YES" : "NO"} won
                    </div>
                  )}
              </div>
            </section>
          ) : (
            <div className="text-red-400 text-sm">
              Failed to load market data.
            </div>
          )}

          {/* User's On-Chain Position */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Your Position
            </h3>
            {!userAddress ? (
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-500 text-center">
                Connect wallet to view your position.
              </div>
            ) : isBettorsLoading ? (
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400 animate-pulse text-center">
                Loading position...
              </div>
            ) : userPosition ? (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">YES Bet</div>
                    <div className="text-green-400 font-mono text-lg">
                      {userPosition.yesAmount > 0n
                        ? formatCredits(userPosition.yesAmount)
                        : "-"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">NO Bet</div>
                    <div className="text-red-400 font-mono text-lg">
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
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-500 text-center">
                No position in this market.
              </div>
            )}
          </section>

          {/* On-Chain Bettor Ledger */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              On-Chain Ledger
            </h3>
            {isBettorsLoading ? (
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400 animate-pulse text-center">
                Enumerating on-chain bettors...
              </div>
            ) : error ? (
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-red-400 text-center">
                Failed to load bettor data.
              </div>
            ) : bettors.length === 0 ? (
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-500 text-center">
                No bettors found on-chain.
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left px-4 py-2 font-medium">
                        #
                      </th>
                      <th className="text-left px-4 py-2 font-medium">
                        Address
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        YES
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        NO
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        % of Pool
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bettors.map((bettor, idx) => {
                      const bettorTotal =
                        bettor.yesAmount + bettor.noAmount;
                      const poolShare =
                        totalPool > 0n
                          ? Number(
                              (bettorTotal * 10000n) / totalPool
                            ) / 100
                          : 0;
                      const isUser =
                        userAddress &&
                        bettor.address === userAddress;
                      return (
                        <tr
                          key={bettor.address}
                          className={`border-b border-gray-800 last:border-0 ${
                            isUser ? "bg-blue-900/20" : ""
                          }`}
                        >
                          <td className="px-4 py-2 text-gray-600">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            <a
                              href={`https://testnet.explorer.provable.com/address/${bettor.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`hover:underline ${isUser ? "text-blue-400" : "text-gray-300 hover:text-white"}`}
                            >
                              {truncateAddress(bettor.address)}
                            </a>
                            {isUser && (
                              <span className="ml-1 text-blue-400 text-xs">
                                (you)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-green-400">
                            {bettor.yesAmount > 0n
                              ? formatCredits(bettor.yesAmount)
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-right text-red-400">
                            {bettor.noAmount > 0n
                              ? formatCredits(bettor.noAmount)
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400">
                            {poolShare.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
