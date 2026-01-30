// Off-chain market metadata registry
// Leo can't store strings on-chain, so market questions/labels come from:
// 1. Supabase (shared, persistent — preferred source)
// 2. localStorage (written by CreateMarketModal on market creation — instant cache)
// 3. public/markets.json (static fallback / shared registry)
// Markets are DISCOVERED from on-chain (market_count + market_ids mappings).

import { supabase, upsertMarketMeta } from "./supabase";

const LS_KEY = "ppm_market_meta";

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

/** Read locally-stored metadata (created by this browser's admin) */
function getLocalMeta(): Record<string, MarketMeta> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, MarketMeta>;
  } catch {
    return {};
  }
}

/** Save metadata for a newly created market.
 *  Dual write: localStorage (instant) + Supabase (shared/persistent). */
export function saveMarketMeta(
  marketId: string,
  meta: MarketMeta
): void {
  // 1. localStorage — instant display for this browser
  const existing = getLocalMeta();
  existing[marketId] = meta;
  localStorage.setItem(LS_KEY, JSON.stringify(existing));
  // Bust the merged cache so next fetch picks it up
  cachedRegistry = null;

  // 2. Supabase — shared with all users (fire-and-forget)
  upsertMarketMeta({
    marketId,
    title: meta.question,
    endDate: meta.endDate,
    categoryId: meta.category ?? "other",
  }).catch((e) => console.warn("Supabase meta write failed:", e));
}

export async function fetchMarketRegistry(): Promise<MarketRegistry> {
  if (cachedRegistry) return cachedRegistry;

  // Try Supabase first (shared, up-to-date)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("market_id, title, end_date, category_id");
      if (!error && data && data.length > 0) {
        const supaMarkets: Record<string, MarketMeta> = {};
        for (const row of data) {
          supaMarkets[row.market_id] = {
            question: row.title,
            endDate: row.end_date,
            category: row.category_id ?? undefined,
          };
        }
        // Merge: localStorage overrides Supabase (local edits take priority)
        const localMarkets = getLocalMeta();
        cachedRegistry = {
          markets: { ...supaMarkets, ...localMarkets },
        };
        return cachedRegistry;
      }
    } catch (e) {
      console.warn("Supabase registry fetch failed, falling back:", e);
    }
  }

  // Fallback: static JSON + localStorage
  let jsonMarkets: Record<string, MarketMeta> = {};
  try {
    const res = await fetch("/markets.json");
    if (res.ok) {
      const data = (await res.json()) as MarketRegistry;
      jsonMarkets = data.markets ?? {};
    }
  } catch (e) {
    console.error("Failed to fetch markets.json:", e);
  }

  // Merge: localStorage overrides static JSON
  const localMarkets = getLocalMeta();
  cachedRegistry = {
    markets: { ...jsonMarkets, ...localMarkets },
  };
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
