import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMarkets, subscribeToMarkets, supabase } from "../lib/supabase";
import { getAllMarketIds, getMarkets, type MarketData } from "../lib/aleo";
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

function supabaseRowToDisplay(m: SupabaseMarketRow): DisplayMarket {
  let outcome: boolean | undefined;
  if (m.outcome === 1) outcome = true;
  else if (m.outcome === 2) outcome = false;

  return {
    id: m.market_id,
    question: m.title,
    yesPool: m.yes_pool ?? 0,
    noPool: m.no_pool ?? 0,
    status: STATUS_MAP[m.status ?? 0] ?? "open",
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
      status: STATUS_MAP[m.status] ?? "open",
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
          const markets = await fetchMarkets();
          if (markets.length > 0) {
            return markets.map(supabaseRowToDisplay);
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
          return old.map((m) => (m.id === display.id ? display : m));
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
