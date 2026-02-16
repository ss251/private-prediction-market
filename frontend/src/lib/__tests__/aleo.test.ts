import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculatePayout,
  formatCredits,
  formatPool,
  getAllMarketIds,
  getOracleAttestedData,
  getAdminAddress,
  getMarketCount,
  estimateBlockHeight,
  PROGRAM_ID,
  ORACLE_PROGRAM_ID,
} from "../aleo";

describe("aleo utilities", () => {
  describe("PROGRAM_ID", () => {
    it("is set to test004", () => {
      expect(PROGRAM_ID).toBe("prediction_market_test004.aleo");
    });

    it("has oracle program ID set", () => {
      expect(ORACLE_PROGRAM_ID).toBe("lasagna_oracle_v1.aleo");
    });
  });

  describe("calculatePayout", () => {
    it("calculates payout for winning YES bet", () => {
      const payout = calculatePayout(
        1_000_000n, // 1 credit bet
        5_000_000n, // 5 credits YES pool
        3_000_000n, // 3 credits NO pool
        true, // bet on YES
        true // YES won
      );
      // total = 8M, fee = 160k (2%), net = 7840k
      // payout = (1M * 7840k) / 5M = 1568000
      expect(payout).toBe(1_568_000n);
    });

    it("returns 0 for losing bet", () => {
      const payout = calculatePayout(
        1_000_000n,
        5_000_000n,
        3_000_000n,
        true, // bet YES
        false // NO won
      );
      expect(payout).toBe(0n);
    });

    it("handles equal pools", () => {
      const payout = calculatePayout(
        1_000_000n,
        5_000_000n,
        5_000_000n,
        true,
        true
      );
      // total = 10M, fee = 200k, net = 9800k
      // payout = (1M * 9800k) / 5M = 1960000
      expect(payout).toBe(1_960_000n);
    });

    it("returns 0 when winning pool is 0", () => {
      const payout = calculatePayout(1_000_000n, 0n, 5_000_000n, true, true);
      expect(payout).toBe(0n);
    });
  });

  describe("formatCredits", () => {
    it("formats microcredits to credits string", () => {
      const result = formatCredits(1_000_000n);
      expect(result).toContain("1");
    });

    it("handles zero", () => {
      const result = formatCredits(0n);
      expect(result).toContain("0");
    });

    it("formats small amounts", () => {
      const result = formatCredits(1000n);
      expect(result).toContain("0.001");
    });
  });

  describe("formatPool", () => {
    it("returns 0 for zero value", () => {
      expect(formatPool(0n)).toBe("0");
    });

    it("formats values under 1000 credits", () => {
      const result = formatPool(5_000_000n); // 5 credits
      expect(result).toBe("5");
    });

    it("formats large values with k suffix", () => {
      const result = formatPool(1_500_000_000n); // 1500 credits
      expect(result).toBe("1.5k");
    });
  });

  describe("getAllMarketIds", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns empty array when market_count is 0", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('"0u64"'),
      });

      const ids = await getAllMarketIds();
      expect(ids).toEqual([]);
    });

    it("returns empty array when market_count is null", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const ids = await getAllMarketIds();
      expect(ids).toEqual([]);
    });

    it("fetches market IDs for count > 0", async () => {
      const fetchMock = vi.fn();
      // First call: market_count
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('"2u64"'),
      });
      // Second call: market_ids[0]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('"1field"'),
      });
      // Third call: market_ids[1]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('"2field"'),
      });

      globalThis.fetch = fetchMock;

      const ids = await getAllMarketIds();
      expect(ids).toEqual(["1field", "2field"]);
    });
  });

  describe("getOracleAttestedData", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns parsed attested data when available", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            '"{ data: 15000000u128, attestation_timestamp: 1706500000u128 }"'
          ),
      });

      const result = await getOracleAttestedData(12345n);
      expect(result).toEqual({
        data: 15000000n,
        timestamp: 1706500000n,
      });
    });

    it("returns null when data is not available", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getOracleAttestedData(99999n);
      expect(result).toBeNull();
    });

    it("returns null on malformed response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('"invalid data"'),
      });

      const result = await getOracleAttestedData(12345n);
      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      const result = await getOracleAttestedData(12345n);
      expect(result).toBeNull();
    });
  });

  describe("getAdminAddress", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns admin address when set", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            '"aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc"'
          ),
      });

      const result = await getAdminAddress();
      expect(result).toBe(
        "aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc"
      );
    });

    it("returns null when not set", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getAdminAddress();
      expect(result).toBeNull();
    });
  });

  describe("getMarketCount", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns count when set", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('"5u64"'),
      });

      const result = await getMarketCount();
      expect(result).toBe(5);
    });

    it("returns 0 when not set", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getMarketCount();
      expect(result).toBe(0);
    });

    it("returns 0 for null value", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('"null"'),
      });

      const result = await getMarketCount();
      expect(result).toBe(0);
    });
  });

  describe("estimateBlockHeight", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns current height for past dates", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("100000"),
      });

      const pastDate = new Date(Date.now() - 86400 * 1000);
      const result = await estimateBlockHeight(pastDate);
      // For past dates, diffSeconds is 0, so blocksAhead is 0
      expect(result).toBe(100000);
    });

    it("estimates future block height correctly", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("100000"),
      });

      // 1 hour from now = 3600 seconds / 5 = 720 blocks
      const futureDate = new Date(Date.now() + 3600 * 1000);
      const result = await estimateBlockHeight(futureDate);
      // Allow some tolerance for timing
      expect(result).toBeGreaterThanOrEqual(100700);
      expect(result).toBeLessThanOrEqual(100721);
    });

    it("handles getLatestHeight returning 0", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const futureDate = new Date(Date.now() + 3600 * 1000);
      const result = await estimateBlockHeight(futureDate);
      // Should still compute blocks ahead even with height 0
      expect(result).toBeGreaterThan(0);
    });
  });
});
