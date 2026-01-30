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
