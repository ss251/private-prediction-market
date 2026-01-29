// Off-chain market metadata registry
// Leo can't store strings, so market questions/labels live in a static JSON file

export interface MarketMeta {
  question: string;
  endDate: string;
  category?: string;
}

export interface MarketRegistry {
  markets: Record<string, MarketMeta>;
}

let cachedRegistry: MarketRegistry | null = null;

/** @internal Clear cache — for testing only */
export function _clearRegistryCache() {
  cachedRegistry = null;
}

export async function fetchMarketRegistry(): Promise<MarketRegistry> {
  if (cachedRegistry) return cachedRegistry;
  const res = await fetch("/markets.json");
  if (!res.ok) {
    console.error("Failed to fetch markets.json:", res.status);
    return { markets: {} };
  }
  cachedRegistry = (await res.json()) as MarketRegistry;
  return cachedRegistry;
}

export function getMarketLabel(
  registry: MarketRegistry,
  marketId: string
): MarketMeta {
  const meta = registry.markets[marketId];
  if (meta) return meta;
  // Fallback for unknown markets discovered on-chain
  return {
    question: `Market #${marketId}`,
    endDate: "TBD",
  };
}
