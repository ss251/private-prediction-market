import {
  pgTable, text, smallint, integer, bigint, boolean, timestamp,
  numeric, index, serial,
} from "drizzle-orm/pg-core";

// --- Categories ---
export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Markets: metadata + cached on-chain state ---
export const markets = pgTable("markets", {
  marketId: text("market_id").primaryKey(),

  // Metadata (set by admin on creation)
  title: text("title").notNull(),
  description: text("description").default(""),
  categoryId: text("category_id").references(() => categories.id).default("other"),
  endDate: text("end_date").notNull(),
  resolutionSource: text("resolution_source").default(""),
  tags: text("tags").array().default([]),
  imageUrl: text("image_url"),

  // Cached on-chain state (updated by indexer)
  status: smallint("status").default(0),          // 0=open, 1=closed, 2=resolved
  yesPool: bigint("yes_pool", { mode: "number" }).default(0),
  noPool: bigint("no_pool", { mode: "number" }).default(0),
  outcome: smallint("outcome"),                    // null=unresolved, 1=yes, 2=no
  endBlock: bigint("end_block", { mode: "number" }),
  paused: boolean("paused").default(false),
  creator: text("creator"),
  oracleEnabled: boolean("oracle_enabled").default(false),

  // Computed columns — generated in SQL migration, not Drizzle-managed.
  // Declared here for type inference only; marked as never-insert.
  totalVolume: bigint("total_volume", { mode: "number" }),
  yesProbability: numeric("yes_probability"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  chainUpdatedAt: timestamp("chain_updated_at"),
  metadataUpdatedAt: timestamp("metadata_updated_at").defaultNow(),
});

// --- Pool snapshots for price/volume charts ---
export const poolSnapshots = pgTable("pool_snapshots", {
  id: serial("id").primaryKey(),
  marketId: text("market_id").notNull().references(() => markets.marketId),
  yesPool: bigint("yes_pool", { mode: "number" }).notNull(),
  noPool: bigint("no_pool", { mode: "number" }).notNull(),
  totalVolume: bigint("total_volume", { mode: "number" }).notNull(),
  yesProbability: numeric("yes_probability").notNull(),
  capturedAt: timestamp("captured_at").defaultNow(),
}, (table) => [
  index("idx_snapshots_market_time").on(table.marketId, table.capturedAt),
]);

// --- Platform-wide stats (singleton row) ---
export const platformStats = pgTable("platform_stats", {
  id: boolean("id").primaryKey().default(true),
  totalMarkets: integer("total_markets").default(0),
  openMarkets: integer("open_markets").default(0),
  totalVolume: bigint("total_volume", { mode: "number" }).default(0),
  lastIndexedAt: timestamp("last_indexed_at"),
});

// --- User positions (indexed from on-chain bet transactions) ---
export const userPositions = pgTable("user_positions", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  marketId: text("market_id").notNull().references(() => markets.marketId),
  yesAmount: bigint("yes_amount", { mode: "number" }).default(0),
  noAmount: bigint("no_amount", { mode: "number" }).default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_positions_wallet").on(table.walletAddress),
  index("idx_user_positions_market").on(table.marketId),
]);

// --- Indexer cursor ---
export const indexerState = pgTable("indexer_state", {
  id: boolean("id").primaryKey().default(true),
  lastMarketCount: integer("last_market_count").default(0),
  lastRunAt: timestamp("last_run_at"),
  lastError: text("last_error"),
});
