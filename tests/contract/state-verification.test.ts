/**
 * On-chain state verification tests.
 *
 * Queries the deployed contract on testnet to verify:
 *  - Admin is initialized
 *  - Markets exist with correct state
 *  - Market registry is consistent
 *  - Pool values are valid
 *
 * These tests require network access to the Aleo explorer API.
 */

import { describe, it, expect } from "vitest";
import {
  getAdmin,
  getMarketCount,
  getMarketStatus,
  getYesPool,
  getNoPool,
  getMarketEndTime,
  getMarketCreator,
  getMarketIdAtIndex,
  getFullMarketState,
  getOracleEnabled,
  getMarketPaused,
} from "../helpers/aleo-api";
import {
  ADMIN_ADDRESS,
  STATUS_OPEN,
  STATUS_CLOSED,
  STATUS_RESOLVED,
  STATUS_CANCELLED,
} from "../helpers/constants";

describe("Admin Initialization", () => {
  it("admin mapping is set", async () => {
    const admin = await getAdmin();
    expect(admin).not.toBeNull();
  });

  it("admin matches expected address", async () => {
    const admin = await getAdmin();
    expect(admin).toBe(ADMIN_ADDRESS);
  });
});

describe("Market Registry", () => {
  it("market_count > 0 (markets have been created)", async () => {
    const count = await getMarketCount();
    expect(count).not.toBeNull();
    expect(count!).toBeGreaterThan(0n);
  });

  it("market_count matches Supabase count (6)", async () => {
    const count = await getMarketCount();
    expect(count).toBe(6n);
  });

  it("market_ids mapping is consistent with market_count", async () => {
    const count = await getMarketCount();
    expect(count).not.toBeNull();

    // Check each index maps to a valid market_id
    for (let i = 0; i < Number(count!); i++) {
      const marketId = await getMarketIdAtIndex(i);
      expect(marketId).not.toBeNull();
      // market_id should be a field value like "1field"
      expect(marketId).toMatch(/field$/);
    }
  });

  it("no market exists beyond market_count", async () => {
    const count = await getMarketCount();
    const beyondId = await getMarketIdAtIndex(Number(count!));
    expect(beyondId).toBeNull();
  });
});

describe("Market State — Market 1", () => {
  const MARKET_ID = "1field";

  it("market exists (has a status)", async () => {
    const status = await getMarketStatus(MARKET_ID);
    expect(status).not.toBeNull();
  });

  it("status is a valid state code", async () => {
    const status = await getMarketStatus(MARKET_ID);
    expect([STATUS_OPEN, STATUS_CLOSED, STATUS_RESOLVED, STATUS_CANCELLED]).toContain(status);
  });

  it("has pool values initialized", async () => {
    const yesPool = await getYesPool(MARKET_ID);
    const noPool = await getNoPool(MARKET_ID);
    expect(yesPool).not.toBeNull();
    expect(noPool).not.toBeNull();
    expect(yesPool!).toBeGreaterThanOrEqual(0n);
    expect(noPool!).toBeGreaterThanOrEqual(0n);
  });

  it("has end_time set", async () => {
    const endTime = await getMarketEndTime(MARKET_ID);
    expect(endTime).not.toBeNull();
    expect(endTime!).toBeGreaterThan(0);
  });

  it("has creator set to admin", async () => {
    const creator = await getMarketCreator(MARKET_ID);
    expect(creator).toBe(ADMIN_ADDRESS);
  });

  it("is not paused by default", async () => {
    const paused = await getMarketPaused(MARKET_ID);
    // Could be null (never set) or false
    expect(paused).not.toBe(true);
  });
});

describe("All Markets — State Consistency", () => {
  it("all registered markets have valid status", async () => {
    const count = await getMarketCount();

    for (let i = 0; i < Number(count!); i++) {
      const marketId = await getMarketIdAtIndex(i);
      const status = await getMarketStatus(marketId!);
      expect(status).not.toBeNull();
      expect([STATUS_OPEN, STATUS_CLOSED, STATUS_RESOLVED, STATUS_CANCELLED]).toContain(status);
    }
  });

  it("all markets have non-negative pool values", async () => {
    const count = await getMarketCount();

    for (let i = 0; i < Number(count!); i++) {
      const marketId = await getMarketIdAtIndex(i);
      const yesPool = await getYesPool(marketId!);
      const noPool = await getNoPool(marketId!);
      expect(yesPool!).toBeGreaterThanOrEqual(0n);
      expect(noPool!).toBeGreaterThanOrEqual(0n);
    }
  });

  it("all markets have creator address", async () => {
    const count = await getMarketCount();

    for (let i = 0; i < Number(count!); i++) {
      const marketId = await getMarketIdAtIndex(i);
      const creator = await getMarketCreator(marketId!);
      expect(creator).not.toBeNull();
      expect(creator!).toMatch(/^aleo1/);
    }
  });
});

describe("Full Market State Snapshot", () => {
  it("fetches all state for market 1 in parallel", async () => {
    const state = await getFullMarketState("1field");

    expect(state.status).not.toBeNull();
    expect(state.yesPool).not.toBeNull();
    expect(state.noPool).not.toBeNull();
    expect(state.endTime).not.toBeNull();
    expect(state.creator).not.toBeNull();

    // Log for visibility
    console.log("Market 1 state:", {
      status: state.status,
      yesPool: state.yesPool?.toString(),
      noPool: state.noPool?.toString(),
      endTime: state.endTime,
      creator: state.creator,
      paused: state.paused,
      oracleEnabled: state.oracleEnabled,
    });
  });
});
