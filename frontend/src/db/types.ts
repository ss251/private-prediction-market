import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { markets, categories, poolSnapshots, platformStats } from "./schema";

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
