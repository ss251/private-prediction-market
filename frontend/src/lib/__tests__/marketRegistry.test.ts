import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase as unavailable — tests exercise the localStorage + JSON fallback path
vi.mock("../supabase", () => ({
  supabase: null,
  upsertMarketMeta: vi.fn().mockResolvedValue(undefined),
}));

import {
  fetchMarketRegistry,
  getMarketLabel,
  _clearRegistryCache,
  type MarketRegistry,
} from "../marketRegistry";

describe("marketRegistry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _clearRegistryCache();
  });

  describe("fetchMarketRegistry", () => {
    it("fetches and returns the registry JSON", async () => {
      const mockRegistry: MarketRegistry = {
        markets: {
          "1field": {
            question: "Will BTC reach $150k?",
            endDate: "2026-12-31",
          },
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRegistry),
      });

      const result = await fetchMarketRegistry();
      expect(result.markets["1field"].question).toBe("Will BTC reach $150k?");
    });

    it("returns empty markets on fetch error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await fetchMarketRegistry();
      expect(result.markets).toEqual({});
    });

    it("returns cached registry on second call", async () => {
      const mockRegistry: MarketRegistry = {
        markets: {
          "1field": {
            question: "Will BTC reach $150k?",
            endDate: "2026-12-31",
          },
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRegistry),
      });

      await fetchMarketRegistry();
      const result = await fetchMarketRegistry();
      expect(result.markets["1field"].question).toBe("Will BTC reach $150k?");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getMarketLabel", () => {
    const registry: MarketRegistry = {
      markets: {
        "1field": {
          question: "Will BTC reach $150k?",
          endDate: "2026-12-31",
          category: "crypto",
        },
      },
    };

    it("returns metadata for known market", () => {
      const meta = getMarketLabel(registry, "1field");
      expect(meta.question).toBe("Will BTC reach $150k?");
      expect(meta.endDate).toBe("2026-12-31");
    });

    it("returns fallback for unknown market", () => {
      const meta = getMarketLabel(registry, "999field");
      expect(meta.question).toBe("Market #999field");
      expect(meta.endDate).toBe("TBD");
    });
  });
});
