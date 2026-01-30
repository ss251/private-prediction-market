import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { markets, categories, poolSnapshots, platformStats } from "./schema";

// Drizzle-inferred types (camelCase — used by Edge Functions with drizzle client)
export type Market = InferSelectModel<typeof markets>;
export type MarketInsert = InferInsertModel<typeof markets>;
export type Category = InferSelectModel<typeof categories>;
export type PoolSnapshot = InferSelectModel<typeof poolSnapshots>;
export type PlatformStats = InferSelectModel<typeof platformStats>;

// Subset for metadata creation (frontend form fields only)
export type MarketMetaInsert = Pick<MarketInsert,
  "marketId" | "title" | "description" | "categoryId" | "endDate" |
  "resolutionSource" | "tags" | "imageUrl"
>;

// Raw Supabase REST row type (snake_case — matches actual API response)
export interface SupabaseMarketRow {
  market_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  end_date: string;
  resolution_source: string | null;
  tags: string[] | null;
  image_url: string | null;
  status: number | null;
  yes_pool: number | null;
  no_pool: number | null;
  outcome: number | null;
  end_block: number | null;
  paused: boolean | null;
  creator: string | null;
  oracle_enabled: boolean | null;
  total_volume: number | null;
  yes_probability: string | null;
  created_at: string | null;
  chain_updated_at: string | null;
  metadata_updated_at: string | null;
}
