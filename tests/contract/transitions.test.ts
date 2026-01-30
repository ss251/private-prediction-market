/**
 * Contract transition tests using `leo run`.
 *
 * `leo run` executes transitions locally WITHOUT finalize blocks.
 * This tests:
 *  - Transition input validation (MIN_BET, types)
 *  - Record creation (Bet records)
 *  - Output structure
 *
 * Finalize logic (mapping updates, access control) is tested
 * separately via on-chain state verification tests.
 */

import { describe, it, expect } from "vitest";
import { leoRun, expectLeoRunSuccess, expectLeoRunFailure } from "../helpers/leo-runner";

describe("create_market transition", () => {
  it("accepts valid market creation inputs", () => {
    const result = expectLeoRunSuccess("create_market", [
      "100field",       // market_id
      "9999999u32",     // end_time (far future)
      "1field",         // yes_label_hash
      "2field",         // no_label_hash
    ]);

    // Should output a Future
    expect(result.output).toContain("create_market");
  });

  it("accepts different market IDs", () => {
    const result = expectLeoRunSuccess("create_market", [
      "999field",
      "9999999u32",
      "100field",
      "200field",
    ]);
    expect(result.success).toBe(true);
  });
});

describe("place_bet transition", () => {
  it("creates Bet record for YES outcome", () => {
    const result = expectLeoRunSuccess("place_bet", [
      "1field",       // market_id
      "true",         // outcome (YES)
      "1000000u64",   // amount (1 credit)
    ]);

    // place_bet returns (Bet record, Future) — verify it compiled and ran
    expect(result.stdout).toContain("place_bet");
  });

  it("creates Bet record for NO outcome", () => {
    const result = expectLeoRunSuccess("place_bet", [
      "1field",
      "false",        // outcome (NO)
      "5000000u64",   // amount (5 credits)
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts minimum bet amount (1000 microcredits)", () => {
    const result = expectLeoRunSuccess("place_bet", [
      "1field",
      "true",
      "1000u64",      // MIN_BET
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects bet below minimum", () => {
    const result = expectLeoRunFailure("place_bet", [
      "1field",
      "true",
      "999u64",       // Below MIN_BET
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects zero bet amount", () => {
    const result = expectLeoRunFailure("place_bet", [
      "1field",
      "true",
      "0u64",
    ]);
    expect(result.success).toBe(false);
  });
});

describe("close_betting transition", () => {
  it("accepts valid close_betting call", () => {
    const result = expectLeoRunSuccess("close_betting", ["1field"]);
    expect(result.output).toContain("close_betting");
  });
});

describe("resolve_market transition", () => {
  it("accepts YES outcome", () => {
    const result = expectLeoRunSuccess("resolve_market", [
      "1field",   // market_id
      "true",     // outcome = YES wins
    ]);
    expect(result.output).toContain("resolve_market");
  });

  it("accepts NO outcome", () => {
    const result = expectLeoRunSuccess("resolve_market", [
      "1field",
      "false",    // outcome = NO wins
    ]);
    expect(result.output).toContain("resolve_market");
  });
});

describe("cancel_market transition", () => {
  it("accepts valid cancel_market call", () => {
    const result = expectLeoRunSuccess("cancel_market", ["1field"]);
    expect(result.output).toContain("cancel_market");
  });
});

describe("set_operator transition", () => {
  it("accepts valid operator address", () => {
    const result = expectLeoRunSuccess("set_operator", [
      "aleo1vuxp3mgw9tq25wzwwdn5vfrym45p444fq7rf9s4krd3rmne7xupqzl906l",
    ]);
    expect(result.output).toContain("set_operator");
  });
});

describe("pause_market / unpause_market transitions", () => {
  it("pause_market accepts valid input", () => {
    const result = expectLeoRunSuccess("pause_market", ["1field"]);
    expect(result.output).toContain("pause_market");
  });

  it("unpause_market accepts valid input", () => {
    const result = expectLeoRunSuccess("unpause_market", ["1field"]);
    expect(result.output).toContain("unpause_market");
  });
});

describe("set_market_oracle transition", () => {
  it("accepts valid oracle configuration", () => {
    const result = expectLeoRunSuccess("set_market_oracle", [
      "1field",                // market_id
      "90000000000u128",       // threshold (e.g. $90,000 with 6 decimals)
      "12345678u128",          // request_hash
    ]);
    expect(result.output).toContain("set_market_oracle");
  });
});

describe("resolve_with_oracle transition", () => {
  it("accepts valid market_id", () => {
    const result = expectLeoRunSuccess("resolve_with_oracle", ["1field"]);
    expect(result.output).toContain("resolve_with_oracle");
  });
});

describe("initialize transition", () => {
  it("accepts valid admin address", () => {
    const result = expectLeoRunSuccess("initialize", [
      "aleo1vuxp3mgw9tq25wzwwdn5vfrym45p444fq7rf9s4krd3rmne7xupqzl906l",
    ]);
    expect(result.output).toContain("initialize");
  });
});

describe("withdraw_fees transition", () => {
  it("accepts valid fee withdrawal inputs", () => {
    const result = expectLeoRunSuccess("withdraw_fees", [
      "1field",       // market_id
      "20000u64",     // claimed_fee_amount
    ]);
    expect(result.output).toContain("withdraw_fees");
  });
});
