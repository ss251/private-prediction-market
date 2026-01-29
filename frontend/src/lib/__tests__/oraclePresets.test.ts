import { describe, it, expect } from "vitest";
import {
  humanPriceToThreshold,
  thresholdToHumanPrice,
  ORACLE_PRESETS,
  getPresetById,
} from "../oraclePresets";

describe("oraclePresets", () => {
  describe("humanPriceToThreshold", () => {
    it("converts $150,000 with precision 2", () => {
      expect(humanPriceToThreshold(150_000, 2)).toBe(15_000_000n);
    });

    it("converts $1 with precision 2", () => {
      expect(humanPriceToThreshold(1, 2)).toBe(100n);
    });

    it("converts $99.99 with precision 2", () => {
      expect(humanPriceToThreshold(99.99, 2)).toBe(9999n);
    });

    it("converts $0.50 with precision 2", () => {
      expect(humanPriceToThreshold(0.5, 2)).toBe(50n);
    });

    it("converts with precision 0", () => {
      expect(humanPriceToThreshold(150_000, 0)).toBe(150_000n);
    });

    it("converts with precision 4", () => {
      expect(humanPriceToThreshold(1.2345, 4)).toBe(12345n);
    });

    it("handles zero", () => {
      expect(humanPriceToThreshold(0, 2)).toBe(0n);
    });

    it("rounds fractional results", () => {
      // 1.006 * 100 = 100.6 → rounds to 101
      expect(humanPriceToThreshold(1.006, 2)).toBe(101n);
    });
  });

  describe("thresholdToHumanPrice", () => {
    it("converts 15000000 with precision 2 to $150,000", () => {
      expect(thresholdToHumanPrice(15_000_000n, 2)).toBe(150_000);
    });

    it("converts 100 with precision 2 to $1", () => {
      expect(thresholdToHumanPrice(100n, 2)).toBe(1);
    });

    it("converts 9999 with precision 2 to $99.99", () => {
      expect(thresholdToHumanPrice(9999n, 2)).toBe(99.99);
    });

    it("converts with precision 0", () => {
      expect(thresholdToHumanPrice(150_000n, 0)).toBe(150_000);
    });

    it("handles zero", () => {
      expect(thresholdToHumanPrice(0n, 2)).toBe(0);
    });

    it("is inverse of humanPriceToThreshold", () => {
      const price = 42_567.89;
      const precision = 2;
      const threshold = humanPriceToThreshold(price, precision);
      const roundTrip = thresholdToHumanPrice(threshold, precision);
      expect(roundTrip).toBeCloseTo(price, precision);
    });
  });

  describe("ORACLE_PRESETS", () => {
    it("has at least 4 presets", () => {
      expect(ORACLE_PRESETS.length).toBeGreaterThanOrEqual(4);
    });

    it("all presets have required fields", () => {
      for (const preset of ORACLE_PRESETS) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.category).toBeTruthy();
        expect(preset.thresholdLabel).toBeTruthy();
        expect(preset.thresholdUnit).toBeTruthy();

        // Request fields
        expect(preset.request.url).toMatch(/^https?:\/\//);
        expect(preset.request.requestMethod).toBe("GET");
        expect(preset.request.selector).toBeTruthy();
        expect(preset.request.responseFormat).toBe("json");
        expect(preset.request.encodingOptions).toBeDefined();
        expect(preset.request.encodingOptions.value).toBe("float");
        expect(preset.request.encodingOptions.precision).toBeGreaterThanOrEqual(0);
      }
    });

    it("has unique IDs", () => {
      const ids = ORACLE_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("includes BTC Binance preset", () => {
      const btc = ORACLE_PRESETS.find((p) => p.id === "btc_binance");
      expect(btc).toBeDefined();
      expect(btc!.name).toContain("Bitcoin");
      expect(btc!.request.url).toContain("binance");
    });

    it("includes ETH Binance preset", () => {
      const eth = ORACLE_PRESETS.find((p) => p.id === "eth_binance");
      expect(eth).toBeDefined();
      expect(eth!.name).toContain("Ethereum");
    });

    it("includes BTC Coinbase preset", () => {
      const btc = ORACLE_PRESETS.find((p) => p.id === "btc_coinbase");
      expect(btc).toBeDefined();
      expect(btc!.request.url).toContain("coinbase");
    });

    it("includes SOL Binance preset", () => {
      const sol = ORACLE_PRESETS.find((p) => p.id === "sol_binance");
      expect(sol).toBeDefined();
      expect(sol!.name).toContain("Solana");
    });
  });

  describe("getPresetById", () => {
    it("finds existing preset", () => {
      const preset = getPresetById("btc_binance");
      expect(preset).toBeDefined();
      expect(preset!.id).toBe("btc_binance");
    });

    it("returns undefined for unknown id", () => {
      const preset = getPresetById("nonexistent");
      expect(preset).toBeUndefined();
    });
  });
});
