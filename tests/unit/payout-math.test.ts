/**
 * Unit tests for parimutuel payout math.
 *
 * These test the exact same calculation the contract performs in
 * finalize_claim_winnings, ensuring frontend payout estimates match.
 *
 * Contract formula:
 *   fee_amount = (total_pool * FEE_BPS) / 10000
 *   net_pool = total_pool - fee_amount
 *   winning_pool = outcome ? yes_pool : no_pool
 *   payout = (bet_amount * net_pool) / winning_pool   (if winner)
 *   payout = 0                                         (if loser)
 */

import { describe, it, expect } from "vitest";
import { FEE_BPS, BPS_DENOMINATOR, MIN_BET } from "../helpers/constants";

// ── Replicate contract math exactly ──

function calculateFee(totalPool: bigint): bigint {
  return (totalPool * FEE_BPS) / BPS_DENOMINATOR;
}

function calculatePayout(
  betAmount: bigint,
  betOutcome: boolean,
  yesPool: bigint,
  noPool: bigint,
  winningOutcome: boolean
): bigint {
  const isWinner = betOutcome === winningOutcome;
  if (!isWinner) return 0n;

  const totalPool = yesPool + noPool;
  const feeAmount = calculateFee(totalPool);
  const netPool = totalPool - feeAmount;
  const winningPool = winningOutcome ? yesPool : noPool;

  // Use u128 intermediate (BigInt handles this naturally)
  return (betAmount * netPool) / winningPool;
}

// ── Tests ──

describe("Fee Calculation", () => {
  it("calculates 2% fee correctly", () => {
    // 100,000 * 200 / 10000 = 2,000
    expect(calculateFee(100_000n)).toBe(2_000n);
  });

  it("calculates fee for 1 credit (1,000,000 microcredits)", () => {
    // 1,000,000 * 200 / 10000 = 20,000
    expect(calculateFee(1_000_000n)).toBe(20_000n);
  });

  it("calculates fee for large pool (100 credits)", () => {
    // 100,000,000 * 200 / 10000 = 2,000,000
    expect(calculateFee(100_000_000n)).toBe(2_000_000n);
  });

  it("handles minimum bet fee (rounds down to 0 for tiny pools)", () => {
    // 1000 * 200 / 10000 = 20
    expect(calculateFee(MIN_BET)).toBe(20n);
  });

  it("handles fee = 0 for pool < 50 microcredits", () => {
    // 49 * 200 / 10000 = 0 (integer division)
    expect(calculateFee(49n)).toBe(0n);
  });

  it("fee for zero pool is zero", () => {
    expect(calculateFee(0n)).toBe(0n);
  });
});

describe("Payout Calculation", () => {
  it("equal pools: winner gets ~98% of their proportional share", () => {
    // 50/50 split, bet 1 credit on YES, YES wins
    const yesPool = 1_000_000n; // 1 credit
    const noPool = 1_000_000n;  // 1 credit
    const betAmount = 1_000_000n;
    const payout = calculatePayout(betAmount, true, yesPool, noPool, true);

    // Total = 2M, fee = 40K, net = 1,960,000
    // Payout = (1M * 1.96M) / 1M = 1,960,000 (98% of total pool)
    expect(payout).toBe(1_960_000n);
  });

  it("sole winner takes all (minus fees)", () => {
    // Only bettor on YES side, YES wins
    const yesPool = 500_000n;
    const noPool = 1_500_000n;
    const betAmount = 500_000n;
    const payout = calculatePayout(betAmount, true, yesPool, noPool, true);

    // Total = 2M, fee = 40K, net = 1,960,000
    // Payout = (500K * 1.96M) / 500K = 1,960,000
    expect(payout).toBe(1_960_000n);
  });

  it("loser gets nothing", () => {
    const payout = calculatePayout(
      1_000_000n,  // bet amount
      false,        // bet on NO
      500_000n,     // yes pool
      1_500_000n,   // no pool
      true          // YES wins
    );
    expect(payout).toBe(0n);
  });

  it("multiple winners split proportionally", () => {
    // YES pool = 2M (two bettors: 1.5M + 0.5M), NO pool = 1M
    const yesPool = 2_000_000n;
    const noPool = 1_000_000n;

    // Total = 3M, fee = 60K, net = 2,940,000
    const bigBetPayout = calculatePayout(1_500_000n, true, yesPool, noPool, true);
    const smallBetPayout = calculatePayout(500_000n, true, yesPool, noPool, true);

    // bigBet: (1.5M * 2.94M) / 2M = 2,205,000
    expect(bigBetPayout).toBe(2_205_000n);

    // smallBet: (0.5M * 2.94M) / 2M = 735,000
    expect(smallBetPayout).toBe(735_000n);

    // Total payouts should equal net pool
    expect(bigBetPayout + smallBetPayout).toBe(2_940_000n);
  });

  it("NO wins scenario", () => {
    const yesPool = 3_000_000n;
    const noPool = 1_000_000n;
    const betAmount = 1_000_000n;

    const payout = calculatePayout(betAmount, false, yesPool, noPool, false);

    // Total = 4M, fee = 80K, net = 3,920,000
    // Payout = (1M * 3.92M) / 1M = 3,920,000
    expect(payout).toBe(3_920_000n);
  });

  it("handles heavily skewed pools", () => {
    // 99% on YES, 1% on NO. NO wins → huge payout for NO bettors
    const yesPool = 99_000_000n;
    const noPool = 1_000_000n;
    const betAmount = 1_000_000n; // entire NO pool is one bettor

    const payout = calculatePayout(betAmount, false, yesPool, noPool, false);

    // Total = 100M, fee = 2M, net = 98M
    // Payout = (1M * 98M) / 1M = 98,000,000
    expect(payout).toBe(98_000_000n);
  });

  it("handles minimum bet payout", () => {
    const yesPool = MIN_BET;      // 1000
    const noPool = MIN_BET;       // 1000
    const betAmount = MIN_BET;

    const payout = calculatePayout(betAmount, true, yesPool, noPool, true);

    // Total = 2000, fee = 40, net = 1960
    // Payout = (1000 * 1960) / 1000 = 1960
    expect(payout).toBe(1960n);
  });

  it("integer division truncates (no rounding up)", () => {
    // Create scenario where division doesn't evenly divide
    const yesPool = 3n;
    const noPool = 7n;
    const betAmount = 1n;

    const payout = calculatePayout(betAmount, true, yesPool, noPool, true);

    // Total = 10, fee = 0 (10*200/10000 = 0), net = 10
    // Payout = (1 * 10) / 3 = 3 (truncated from 3.33...)
    expect(payout).toBe(3n);
  });

  it("large pool with many bettors — proportional fairness", () => {
    // Simulate: 100 credits in YES, 50 credits in NO, YES wins
    const yesPool = 100_000_000n;
    const noPool = 50_000_000n;

    // Small bettor: 0.5 credits on YES
    const smallPayout = calculatePayout(500_000n, true, yesPool, noPool, true);

    // Total = 150M, fee = 3M, net = 147M
    // Payout = (0.5M * 147M) / 100M = 735,000
    expect(smallPayout).toBe(735_000n);

    // Verify payout > bet (winner always profits when losing side exists)
    expect(smallPayout).toBeGreaterThan(500_000n);
  });
});

describe("Edge Cases", () => {
  it("single-sided pool: sole bettor gets their money back minus fees", () => {
    // Only YES bets, no NO bets. YES wins.
    const yesPool = 5_000_000n;
    const noPool = 0n;
    const betAmount = 5_000_000n;

    const payout = calculatePayout(betAmount, true, yesPool, noPool, true);

    // Total = 5M, fee = 100K, net = 4.9M
    // Payout = (5M * 4.9M) / 5M = 4,900,000
    expect(payout).toBe(4_900_000n);

    // They lose the 2% fee even though nobody was on the other side
    expect(payout).toBe(betAmount - calculateFee(yesPool));
  });

  it("payout calculation matches u128 intermediate in contract", () => {
    // Large values that would overflow u64 without u128 intermediate
    const yesPool = 18_000_000_000n; // 18,000 credits
    const noPool = 2_000_000_000n;   // 2,000 credits
    const betAmount = 1_000_000_000n;

    const payout = calculatePayout(betAmount, false, yesPool, noPool, false);

    // Total = 20B, fee = 400M, net = 19.6B
    // Payout = (1B * 19.6B) / 2B = 9,800,000,000
    // This intermediate (1B * 19.6B = 19.6 * 10^18) exceeds u64 max (~1.8 * 10^19)
    // but fits in u128
    expect(payout).toBe(9_800_000_000n);
  });
});
