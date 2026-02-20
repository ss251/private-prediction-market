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
 * Replaces the 3-query cascade (marketIds → markets → registry) with a
 * single Supabase query when available.
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

/**
 * Derive effective status: if the DB says "open" but end_date has passed,
 * treat the market as "closed" client-side so the UI never shows an
 * expired market as open.
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
 */
export function useMarkets() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["markets"],
    queryFn: async (): Promise<DisplayMarket[]> => {
      // Try Supabase first
      if (supabase) {
        try {
          // Auto-close expired markets before fetching (aggregates pools)
          const { error: closeErr } = await supabase.rpc("close_expired_markets");
          if (closeErr) console.warn("close_expired_markets RPC:", closeErr.message);

          const markets = await fetchMarkets();
          if (markets.length > 0) {
            const displayed = markets.map(supabaseRowToDisplay);
            // Cross-reference chain for status/outcome on closed markets
            // Chain is source of truth — Supabase may lag behind
            const enhanced = await Promise.all(
              displayed.map(async (m) => {
                if (m.status === "closed" || m.status === "resolved") {
                  try {
                    const [statusRaw, outcomeRaw] = await Promise.all([
                      getMappingValue("market_status", m.id),
                      getMappingValue("market_outcome", m.id),
                    ]);
                    const chainStatus = statusRaw
                      ? Number(statusRaw.replace(/u\d+$/, ""))
                      : 0;
                    const mapped = STATUS_MAP[chainStatus] ?? m.status;
                    // Only upgrade status, never downgrade
                    if (
                      chainStatus > (STATUS_MAP_REVERSE[m.status] ?? 0)
                    ) {
                      let chainOutcome: boolean | undefined;
                      if (outcomeRaw) {
                        const cleaned = outcomeRaw.replace(/^"|"$/g, "");
                        if (cleaned === "true") chainOutcome = true;
                        else if (cleaned === "false") chainOutcome = false;
                      }
                      return { ...m, status: mapped, outcome: chainOutcome };
                    }
                  } catch {
                    // Chain fetch failed, keep Supabase data
                  }
                }
                return m;
              }),
            );
            return enhanced;
          }
        } catch (e) {
          console.warn("Supabase fetch failed, falling back to chain:", e);
        }
      }
      // Fallback to direct chain queries
      return fetchMarketsFromChain();
    },
    refetchInterval: 60_000,
  });

  // Realtime: subscribe to market row changes
  useEffect(() => {
    const channel = subscribeToMarkets((updated) => {
      queryClient.setQueryData<DisplayMarket[]>(["markets"], (old) => {
        if (!old) return old;
        const display = supabaseRowToDisplay(updated);
        const exists = old.some((m) => m.id === display.id);
        if (exists) {
          return old.map((m) => {
            if (m.id !== display.id) return m;
            // Never downgrade status from Realtime — chain is source of truth
            const oldRank = STATUS_MAP_REVERSE[m.status] ?? 0;
            const newRank = STATUS_MAP_REVERSE[display.status] ?? 0;
            if (newRank < oldRank) {
              // Keep the higher status + outcome, update other fields
              return { ...display, status: m.status, outcome: m.outcome ?? display.outcome };
            }
            return display;
          });
        }
        return [display, ...old];
      });
    });
    return () => {
      channel?.unsubscribe();
    };
  }, [queryClient]);

  return query;
}
