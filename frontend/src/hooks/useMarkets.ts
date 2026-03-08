import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMarkets, subscribeToMarkets, supabase } from "../lib/supabase";
import { getAllMarketIds, getMarkets, getMappingValue, type MarketData } from "../lib/aleo";
import {
  fetchMarketRegistry,
  getMarketLabel,
} from "../lib/marketRegistry";
import type { SupabaseMarketRow } from "../db/types";

/**
 * Unified market data that works with both Supabase and chain fallback.
 */
export interface DisplayMarket {
  id: string;
  question: string;
  yesPool: number;
  noPool: number;
  status: "open" | "closed" | "resolved" | "cancelled";
  endDate: string;
  outcome?: boolean;
  paused?: boolean;
  endTime?: number;
  description?: string;
  categoryId?: string;
  totalVolume?: number;
  yesProbability?: string;
}

const STATUS_MAP: Record<number, DisplayMarket["status"]> = {
  0: "open",
  1: "closed",
  2: "resolved",
  3: "cancelled",
};

const STATUS_MAP_REVERSE: Record<string, number> = {
  open: 0,
  closed: 1,
  resolved: 2,
  cancelled: 3,
};

// ── High-water-mark cache (sessionStorage-backed) ─────────────────
// Persists across React renders, query refetches, AND page navigations.
// Once we learn from the chain that a market is resolved, we never forget
// it — even on fresh page loads within the same browser session.
const HW_STORAGE_KEY = "market_status_hw";

type HWEntry = { status: DisplayMarket["status"]; outcome?: boolean };

function loadHighWater(): Map<string, HWEntry> {
  const map = new Map<string, HWEntry>();
  try {
    const raw = sessionStorage.getItem(HW_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, HWEntry>;
      for (const [k, v] of Object.entries(parsed)) {
        map.set(k, v);
      }
    }
  } catch { /* ignore parse errors */ }
  return map;
}

function saveHighWater(map: Map<string, HWEntry>): void {
  try {
    const obj: Record<string, HWEntry> = {};
    for (const [k, v] of map) obj[k] = v;
    sessionStorage.setItem(HW_STORAGE_KEY, JSON.stringify(obj));
  } catch { /* quota or private mode */ }
}

const statusHighWater = loadHighWater();

/**
 * Record the highest-known status for a market. Returns the effective
 * status/outcome (always the highest ever seen). Persists to sessionStorage.
 */
function applyHighWater(m: DisplayMarket): DisplayMarket {
  const cached = statusHighWater.get(m.id);
  const mRank = STATUS_MAP_REVERSE[m.status] ?? 0;
  const cachedRank = cached ? (STATUS_MAP_REVERSE[cached.status] ?? 0) : -1;

  if (mRank > cachedRank) {
    // New status is higher — update the cache + persist
    statusHighWater.set(m.id, { status: m.status, outcome: m.outcome });
    saveHighWater(statusHighWater);
    return m;
  } else if (cachedRank > mRank) {
    // Cached status is higher — override what we were given
    return { ...m, status: cached!.status, outcome: cached!.outcome ?? m.outcome };
  }
  // Same rank — keep outcome if cached has one and new doesn't
  if (cached?.outcome !== undefined && m.outcome === undefined) {
    return { ...m, outcome: cached.outcome };
  }
  return m;
}

/**
 * Derive effective status: if the DB says "open" but end_date has passed,
 * treat the market as "closed" client-side.
 */
function deriveStatus(
  dbStatus: number | null,
  endDate: string,
): DisplayMarket["status"] {
  const mapped = STATUS_MAP[dbStatus ?? 0] ?? "open";
  if (mapped === "open") {
    const end = new Date(endDate).getTime();
    if (!isNaN(end) && Date.now() > end) return "closed";
  }
  return mapped;
}

function supabaseRowToDisplay(m: SupabaseMarketRow): DisplayMarket {
  let outcome: boolean | undefined;
  if (m.outcome === 1) outcome = true;
  else if (m.outcome === 2) outcome = false;

  return {
    id: m.market_id,
    question: m.title,
    yesPool: m.yes_pool ?? 0,
    noPool: m.no_pool ?? 0,
    status: deriveStatus(m.status, m.end_date),
    endDate: m.end_date,
    outcome,
    paused: m.paused ?? false,
    endTime: m.end_block ?? undefined,
    description: m.description ?? undefined,
    categoryId: m.category_id ?? undefined,
    totalVolume: m.total_volume ?? undefined,
    yesProbability: m.yes_probability ?? undefined,
  };
}

/** Cross-reference a single market against on-chain data */
async function crossReferenceChain(m: DisplayMarket): Promise<DisplayMarket> {
  if (m.status !== "closed" && m.status !== "resolved") return m;
  try {
    const [statusRaw, outcomeRaw] = await Promise.all([
      getMappingValue("market_status", m.id),
      getMappingValue("market_outcome", m.id),
    ]);
    const chainStatusNum = statusRaw ? Number(statusRaw.replace(/u\d+$/, "")) : 0;
    const chainStatus = STATUS_MAP[chainStatusNum] ?? m.status;
    // Only upgrade, never downgrade
    if (chainStatusNum > (STATUS_MAP_REVERSE[m.status] ?? 0)) {
      let chainOutcome: boolean | undefined;
      if (outcomeRaw) {
        const cleaned = outcomeRaw.replace(/^"|"$/g, "");
        if (cleaned === "true") chainOutcome = true;
        else if (cleaned === "false") chainOutcome = false;
      }
      return { ...m, status: chainStatus, outcome: chainOutcome };
    }
  } catch {
    // Chain fetch failed — keep what we have
  }
  return m;
}

/** Fallback: original chain-based fetching */
async function fetchMarketsFromChain(): Promise<DisplayMarket[]> {
  const marketIds = await getAllMarketIds();
  if (marketIds.length === 0) return [];
  const [rawMarkets, registry] = await Promise.all([
    getMarkets(marketIds),
    fetchMarketRegistry(),
  ]);
  return rawMarkets.map((m: MarketData) => {
    const meta = getMarketLabel(registry, m.id);
    return {
      id: m.id,
      question: meta.question,
      yesPool: Number(m.yesPool),
      noPool: Number(m.noPool),
      status: deriveStatus(m.status, meta.endDate),
      endDate: meta.endDate,
      outcome: m.outcome,
      paused: m.paused,
      endTime: m.endTime,
    };
  });
}

/**
 * Hook for fetching all markets with Supabase-first strategy and chain fallback.
 * Subscribes to Supabase Realtime for live updates to market rows.
 *
 * Uses a module-level high-water-mark cache so that once a market is known
 * to be "resolved" (from chain), no stale Supabase data can revert it.
 */
export function useMarkets() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["markets"],
    queryFn: async (): Promise<DisplayMarket[]> => {
      // Try Supabase first
      if (supabase) {
        try {
          // Auto-close expired markets before fetching
          const { error: closeErr } = await supabase.rpc("close_expired_markets");
          if (closeErr) console.warn("close_expired_markets RPC:", closeErr.message);

          const markets = await fetchMarkets();
          if (markets.length > 0) {
            const displayed = markets.map(supabaseRowToDisplay);
            // Cross-reference chain for closed/resolved markets
            const enhanced = await Promise.all(displayed.map(crossReferenceChain));
            // Apply high-water-mark: never downgrade from what we've seen before
            return enhanced.map(applyHighWater);
          }
        } catch (e) {
          console.warn("Supabase fetch failed, falling back to chain:", e);
        }
      }
      // Fallback to direct chain queries
      const chainMarkets = await fetchMarketsFromChain();
      return chainMarkets.map(applyHighWater);
    },
    refetchInterval: 60_000,
  });

  // Realtime: subscribe to market row changes.
  // Realtime events come directly from the PostgreSQL WAL (not CDN-cached),
  // so they reflect the true database state.
  useEffect(() => {
    const channel = subscribeToMarkets(async (updated) => {
      const display = supabaseRowToDisplay(updated);
      // Cross-reference chain for closed/resolved markets (same as main query path)
      const enhanced = await crossReferenceChain(display);
      const safe = applyHighWater(enhanced);

      queryClient.setQueryData<DisplayMarket[]>(["markets"], (old) => {
        if (!old) return old;
        const exists = old.some((m) => m.id === safe.id);
        if (exists) {
          return old.map((m) => (m.id === safe.id ? safe : m));
        }
        return [safe, ...old];
      });
    });
    return () => {
      channel?.unsubscribe();
    };
  }, [queryClient]);

  return query;
}
