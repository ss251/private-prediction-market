// On-chain bettor enumeration via BHP256 composite key lookups

import { HashWorker } from "../workers/hashWorker";
import { getMappingValue } from "./aleo";

export interface BettorEntry {
  index: number;
  address: string;
  yesAmount: bigint;
  noAmount: bigint;
}

// Parse Aleo value string like "1000u64" to bigint
function parseU64(value: string | null): bigint {
  if (!value || value === "null") return 0n;
  return BigInt(value.replace(/u\d+$/, "").replace(/field$/, ""));
}

// Parse u16 value like "5u16" to number
function parseU16(value: string | null): number {
  if (!value || value === "null") return 0;
  return parseInt(value.replace(/u\d+$/, ""));
}

// Compute BHP256 hash for a BettorKey (market_id + index)
async function computeBettorKey(
  marketId: string,
  index: number
): Promise<string> {
  const worker = HashWorker();
  return worker.computeBHP256Key("BettorKey", {
    market_id: marketId,
    index: `${index}u16`,
  });
}

// Compute BHP256 hash for a UserKey (market_id + address)
async function computeUserKey(
  marketId: string,
  address: string
): Promise<string> {
  const worker = HashWorker();
  return worker.computeBHP256Key("UserKey", {
    market_id: marketId,
    user: address,
  });
}

/**
 * Enumerate all bettors for a market from on-chain data.
 *
 * Flow:
 * 1. Query bettor_count for market
 * 2. For each index 0..count-1, compute BettorKey hash and query id_to_bettor
 * 3. For each address, compute UserKey hash and query bet amounts
 */
export async function getMarketBettors(
  marketId: string
): Promise<BettorEntry[]> {
  // Step 1: Get bettor count
  const countRaw = await getMappingValue("bettor_count", marketId);
  const count = parseU16(countRaw);

  if (count === 0) return [];

  // Step 2: Resolve bettor addresses via BettorKey hashes
  // Process in batches to avoid overwhelming the worker
  const BATCH_SIZE = 10;
  const bettorAddresses: { index: number; address: string }[] = [];

  for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
    const batchPromises: Promise<{ index: number; address: string | null }>[] =
      [];

    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(
        computeBettorKey(marketId, i).then(async (hashKey) => {
          // Remove trailing "field" suffix if present for mapping lookup
          const key = hashKey.endsWith("field") ? hashKey : `${hashKey}field`;
          const address = await getMappingValue("id_to_bettor", key);
          return { index: i, address };
        })
      );
    }

    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      if (result.address && result.address !== "null") {
        bettorAddresses.push({
          index: result.index,
          address: result.address,
        });
      }
    }
  }

  // Step 3: Fetch bet amounts for each address
  const entries: BettorEntry[] = [];

  for (
    let batchStart = 0;
    batchStart < bettorAddresses.length;
    batchStart += BATCH_SIZE
  ) {
    const batchEnd = Math.min(
      batchStart + BATCH_SIZE,
      bettorAddresses.length
    );
    const batchPromises: Promise<BettorEntry>[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const { index, address } = bettorAddresses[i];
      batchPromises.push(
        computeUserKey(marketId, address).then(async (hashKey) => {
          const key = hashKey.endsWith("field") ? hashKey : `${hashKey}field`;
          const [yesRaw, noRaw] = await Promise.all([
            getMappingValue("bettor_yes_amount", key),
            getMappingValue("bettor_no_amount", key),
          ]);
          return {
            index,
            address,
            yesAmount: parseU64(yesRaw),
            noAmount: parseU64(noRaw),
          };
        })
      );
    }

    const batchResults = await Promise.all(batchPromises);
    entries.push(...batchResults);
  }

  // Sort by total bet amount descending
  entries.sort((a, b) => {
    const totalA = a.yesAmount + a.noAmount;
    const totalB = b.yesAmount + b.noAmount;
    if (totalB > totalA) return 1;
    if (totalB < totalA) return -1;
    return a.index - b.index;
  });

  return entries;
}

/**
 * Get a single user's on-chain bet position for a market.
 * Returns YES and NO amounts from the chain mappings.
 */
export async function getUserPosition(
  marketId: string,
  address: string
): Promise<{ yesAmount: bigint; noAmount: bigint } | null> {
  try {
    const hashKey = await computeUserKey(marketId, address);
    const key = hashKey.endsWith("field") ? hashKey : `${hashKey}field`;
    const [yesRaw, noRaw] = await Promise.all([
      getMappingValue("bettor_yes_amount", key),
      getMappingValue("bettor_no_amount", key),
    ]);
    const yesAmount = parseU64(yesRaw);
    const noAmount = parseU64(noRaw);
    if (yesAmount === 0n && noAmount === 0n) return null;
    return { yesAmount, noAmount };
  } catch (error) {
    console.error("Failed to get user position:", error);
    return null;
  }
}
