import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { PoolSnapshot, PlatformStats, Category, MarketMetaInsert, SupabaseMarketRow } from "../db/types";

// --- Client (null if env vars missing — graceful fallback to chain queries) ---

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

// --- Typed query helpers ---

export async function fetchMarkets(): Promise<SupabaseMarketRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupabaseMarketRow[];
}

export async function fetchMarket(id: string): Promise<SupabaseMarketRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .eq("market_id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as SupabaseMarketRow;
}

export async function fetchPoolHistory(
  marketId: string,
  hours = 168, // 7 days default
): Promise<PoolSnapshot[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("pool_snapshots")
    .select("*")
    .eq("market_id", marketId)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PoolSnapshot[];
}

export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("platform_stats")
    .select("*")
    .eq("id", true)
    .single();
  if (error) return null;
  return data as PlatformStats;
}

export async function fetchCategories(): Promise<Category[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function upsertMarketMeta(meta: MarketMetaInsert): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("markets").upsert(
    {
      market_id: meta.marketId,
      title: meta.title,
      description: meta.description ?? "",
      category_id: meta.categoryId ?? "other",
      end_date: meta.endDate,
      resolution_source: meta.resolutionSource ?? "",
      tags: meta.tags ?? [],
      image_url: meta.imageUrl ?? null,
      metadata_updated_at: new Date().toISOString(),
    },
    { onConflict: "market_id" },
  );
  if (error) console.error("Failed to upsert market metadata:", error);
}

// --- User positions ---

/**
 * Fetch user positions from Supabase for a given wallet and market IDs.
 * Returns aggregated YES/NO amounts per market.
 */
export async function fetchUserPositions(
  walletAddress: string,
  marketIds: string[],
): Promise<{ marketId: string; yesAmount: number; noAmount: number }[]> {
  if (!supabase || marketIds.length === 0) return [];
  const { data, error } = await supabase
    .from("user_positions")
    .select("market_id, yes_amount, no_amount")
    .eq("wallet_address", walletAddress)
    .in("market_id", marketIds);
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    marketId: String(r.market_id),
    yesAmount: Number(r.yes_amount ?? 0),
    noAmount: Number(r.no_amount ?? 0),
  }));
}

/**
 * Upsert a user position in Supabase after a bet is placed.
 * Adds the bet amount to the existing position (or creates a new row).
 */
export async function upsertUserPosition(
  walletAddress: string,
  marketId: string,
  outcome: boolean,
  amount: number,
): Promise<void> {
  if (!supabase) return;
  // First try to get existing
  const { data: existing } = await supabase
    .from("user_positions")
    .select("yes_amount, no_amount")
    .eq("wallet_address", walletAddress)
    .eq("market_id", marketId)
    .single();

  const currentYes = Number(existing?.yes_amount ?? 0);
  const currentNo = Number(existing?.no_amount ?? 0);

  const { error } = await supabase.from("user_positions").upsert(
    {
      wallet_address: walletAddress,
      market_id: marketId,
      yes_amount: outcome ? currentYes + amount : currentYes,
      no_amount: outcome ? currentNo : currentNo + amount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address,market_id" },
  );
  if (error) console.error("Failed to upsert user position:", error);
}

// --- Indexer trigger (fire-and-forget, keeps Supabase in sync with chain) ---

let _indexerStarted = false;

/**
 * Triggers the index-markets Edge Function once on app load, then every 60s.
 * This ensures Supabase stays in sync even if pg_cron isn't running.
 * Safe to call multiple times — only starts once.
 */
export function startIndexerPolling(): void {
  if (_indexerStarted || !supabase || !url) return;
  _indexerStarted = true;

  const invokeIndexer = () => {
    fetch(`${url}/functions/v1/index-markets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch(() => {
      // Silent fail — indexer is best-effort, frontend has chain fallback
    });
  };

  // Fire immediately, then every 60s
  invokeIndexer();
  setInterval(invokeIndexer, 60_000);
}

// --- Realtime subscription ---

export function subscribeToMarkets(
  callback: (market: SupabaseMarketRow) => void,
): RealtimeChannel | null {
  if (!supabase) return null;
  return supabase
    .channel("markets-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "markets" },
      (payload) => {
        if (payload.new && typeof payload.new === "object") {
          callback(payload.new as SupabaseMarketRow);
        }
      },
    )
    .subscribe();
}
