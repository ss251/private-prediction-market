/**
 * Aleo Explorer API helpers for querying on-chain state.
 * Used by integration tests to verify contract mappings.
 */

import { API_BASE, NETWORK, PROGRAM_ID } from "./constants";

const BASE = `${API_BASE}/${NETWORK}/program/${PROGRAM_ID}/mapping`;

/**
 * Query a single mapping value from the deployed contract.
 * Returns the raw string value (e.g. "0u8", "1000u64", "true")
 * or null if the key doesn't exist.
 */
export async function getMappingValue(
  mapping: string,
  key: string
): Promise<string | null> {
  const url = `${BASE}/${mapping}/${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  // API returns JSON-encoded string, e.g. "\"0u8\""
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Parse "123u64" → bigint */
export function parseU64(raw: string | null): bigint | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)u64$/);
  return match ? BigInt(match[1]) : null;
}

/** Parse "123u128" → bigint */
export function parseU128(raw: string | null): bigint | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)u128$/);
  return match ? BigInt(match[1]) : null;
}

/** Parse "5u8" → number */
export function parseU8(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)u8$/);
  return match ? Number(match[1]) : null;
}

/** Parse "999u32" → number */
export function parseU32(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)u32$/);
  return match ? Number(match[1]) : null;
}

/** Parse "true" / "false" → boolean */
export function parseBool(raw: string | null): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/** Parse quoted address: "aleo1..." → string */
export function parseAddress(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/^"|"$/g, "");
}

// ── Typed mapping accessors ──

export async function getMarketStatus(marketId: string): Promise<number | null> {
  return parseU8(await getMappingValue("market_status", marketId));
}

export async function getYesPool(marketId: string): Promise<bigint | null> {
  return parseU64(await getMappingValue("yes_pool", marketId));
}

export async function getNoPool(marketId: string): Promise<bigint | null> {
  return parseU64(await getMappingValue("no_pool", marketId));
}

export async function getMarketOutcome(marketId: string): Promise<boolean | null> {
  return parseBool(await getMappingValue("market_outcome", marketId));
}

export async function getMarketEndTime(marketId: string): Promise<number | null> {
  return parseU32(await getMappingValue("market_end_time", marketId));
}

export async function getMarketCreator(marketId: string): Promise<string | null> {
  return parseAddress(await getMappingValue("market_creator", marketId));
}

export async function getMarketCount(): Promise<bigint | null> {
  return parseU64(await getMappingValue("market_count", "true"));
}

export async function getAdmin(): Promise<string | null> {
  return parseAddress(await getMappingValue("admin", "true"));
}

export async function getMarketPaused(marketId: string): Promise<boolean | null> {
  return parseBool(await getMappingValue("market_paused", marketId));
}

export async function getCollectedFees(marketId: string): Promise<bigint | null> {
  return parseU64(await getMappingValue("collected_fees", marketId));
}

export async function getEstimatedFees(marketId: string): Promise<bigint | null> {
  return parseU64(await getMappingValue("estimated_fees", marketId));
}

export async function getOracleEnabled(marketId: string): Promise<boolean | null> {
  return parseBool(await getMappingValue("oracle_enabled", marketId));
}

export async function getMarketIdAtIndex(index: number): Promise<string | null> {
  const raw = await getMappingValue("market_ids", `${index}u64`);
  return raw;
}

/**
 * Fetch all mapping values for a given market in parallel.
 */
export async function getFullMarketState(marketId: string) {
  const [status, yesPool, noPool, outcome, endTime, creator, paused, fees, oracleEnabled] =
    await Promise.all([
      getMarketStatus(marketId),
      getYesPool(marketId),
      getNoPool(marketId),
      getMarketOutcome(marketId),
      getMarketEndTime(marketId),
      getMarketCreator(marketId),
      getMarketPaused(marketId),
      getEstimatedFees(marketId),
      getOracleEnabled(marketId),
    ]);

  return { status, yesPool, noPool, outcome, endTime, creator, paused, fees, oracleEnabled };
}
