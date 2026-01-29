// Network client for querying Aleo chain state

const API_URL = "https://api.explorer.provable.com/v1/testnet";
export const PROGRAM_ID = "prediction_market_test002.aleo";

// Market status constants (matches contract)
export const MarketStatus = {
  OPEN: 0,
  CLOSED: 1,
  RESOLVED: 2,
  CANCELLED: 3,
} as const;

export type MarketStatus = (typeof MarketStatus)[keyof typeof MarketStatus];

export interface MarketData {
  id: string;
  status: MarketStatus;
  yesPool: bigint;
  noPool: bigint;
  outcome?: boolean;
  bettorCount: number;
  endTime?: number;
  paused?: boolean;
  creator?: string;
  yesLabelHash?: string;
  noLabelHash?: string;
  estimatedFees?: bigint;
}

// Parse Aleo value (e.g., "1000u64" -> 1000n)
function parseAleoValue(value: string | null): bigint {
  if (!value || value === "null") return 0n;
  // Remove type suffix (u8, u16, u64, etc.)
  const cleaned = value.replace(/u\d+$/, "").replace(/field$/, "");
  return BigInt(cleaned);
}

// Parse Aleo boolean
function parseAleoBool(value: string | null): boolean | undefined {
  if (!value || value === "null") return undefined;
  return value === "true";
}

// Parse Aleo u8
function parseAleoU8(value: string | null): number {
  if (!value || value === "null") return 255; // Non-existent
  return parseInt(value.replace(/u\d+$/, ""));
}

// Parse Aleo u32
function parseAleoU32(value: string | null): number | undefined {
  if (!value || value === "null") return undefined;
  return parseInt(value.replace(/u\d+$/, ""));
}

// Parse Aleo address
function parseAleoAddress(value: string | null): string | undefined {
  if (!value || value === "null") return undefined;
  return value;
}

// Parse Aleo field
function parseAleoField(value: string | null): string | undefined {
  if (!value || value === "null") return undefined;
  return value.replace(/field$/, "");
}

// Fetch a mapping value from the network
export async function getMappingValue(
  mapping: string,
  key: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_URL}/program/${PROGRAM_ID}/mapping/${mapping}/${key}`
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.text();
    // API returns quoted string, remove quotes
    return data.replace(/^"|"$/g, "");
  } catch (error) {
    console.error(`Failed to fetch mapping ${mapping}[${key}]:`, error);
    return null;
  }
}

// Get market data from chain (including new metadata)
export async function getMarketData(marketId: string): Promise<MarketData | null> {
  try {
    const [
      statusRaw,
      yesPoolRaw,
      noPoolRaw,
      outcomeRaw,
      bettorCountRaw,
      endTimeRaw,
      pausedRaw,
      creatorRaw,
      yesLabelRaw,
      noLabelRaw,
      estimatedFeesRaw,
    ] = await Promise.all([
      getMappingValue("market_status", marketId),
      getMappingValue("yes_pool", marketId),
      getMappingValue("no_pool", marketId),
      getMappingValue("market_outcome", marketId),
      getMappingValue("bettor_count", marketId),
      getMappingValue("market_end_time", marketId),
      getMappingValue("market_paused", marketId),
      getMappingValue("market_creator", marketId),
      getMappingValue("market_yes_label", marketId),
      getMappingValue("market_no_label", marketId),
      getMappingValue("estimated_fees", marketId),
    ]);

    const status = parseAleoU8(statusRaw);

    // 255 means market doesn't exist
    if (status === 255) return null;

    return {
      id: marketId,
      status: status as MarketStatus,
      yesPool: parseAleoValue(yesPoolRaw),
      noPool: parseAleoValue(noPoolRaw),
      outcome: parseAleoBool(outcomeRaw),
      bettorCount: Number(parseAleoValue(bettorCountRaw)),
      endTime: parseAleoU32(endTimeRaw),
      paused: parseAleoBool(pausedRaw) ?? false,
      creator: parseAleoAddress(creatorRaw),
      yesLabelHash: parseAleoField(yesLabelRaw),
      noLabelHash: parseAleoField(noLabelRaw),
      estimatedFees: parseAleoValue(estimatedFeesRaw),
    };
  } catch (error) {
    console.error(`Failed to fetch market ${marketId}:`, error);
    return null;
  }
}

// Get multiple markets
export async function getMarkets(marketIds: string[]): Promise<MarketData[]> {
  const results = await Promise.all(marketIds.map(getMarketData));
  return results.filter((m): m is MarketData => m !== null);
}

// Discover all market IDs from on-chain registry
export async function getAllMarketIds(): Promise<string[]> {
  const countRaw = await getMappingValue("market_count", "true");
  if (!countRaw || countRaw === "null") return [];
  const count = Number(parseAleoValue(countRaw));
  if (count === 0) return [];

  const BATCH_SIZE = 10;
  const ids: string[] = [];

  for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
    const batchPromises: Promise<string | null>[] = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(getMappingValue("market_ids", `${i}u64`));
    }
    const results = await Promise.all(batchPromises);
    for (const raw of results) {
      if (raw && raw !== "null") {
        // Value comes back as e.g. "1field" — keep as-is
        ids.push(raw);
      }
    }
  }

  return ids;
}

// Get market metadata (convenience wrapper for new fields)
export async function getMarketMetadata(marketId: string): Promise<{
  endTime?: number;
  paused: boolean;
  creator?: string;
  yesLabelHash?: string;
  noLabelHash?: string;
} | null> {
  const market = await getMarketData(marketId);
  if (!market) return null;
  return {
    endTime: market.endTime,
    paused: market.paused ?? false,
    creator: market.creator,
    yesLabelHash: market.yesLabelHash,
    noLabelHash: market.noLabelHash,
  };
}

// Check if a market's betting deadline has passed
export async function isMarketExpired(marketId: string): Promise<boolean> {
  const [endTimeRaw, currentHeight] = await Promise.all([
    getMappingValue("market_end_time", marketId),
    getLatestHeight(),
  ]);
  const endTime = parseAleoU32(endTimeRaw);
  if (endTime === undefined) return false;
  return currentHeight >= endTime;
}

// Get public balance for an address (queries credits.aleo account mapping)
export async function getPublicBalance(address: string): Promise<bigint> {
  try {
    const response = await fetch(
      `${API_URL}/program/credits.aleo/mapping/account/${address}`
    );
    if (!response.ok) return 0n;
    const data = await response.text();
    // API returns quoted string, strip quotes before parsing
    const cleaned = data.replace(/^"|"$/g, "");
    return parseAleoValue(cleaned);
  } catch {
    return 0n;
  }
}

// Get transaction status
export async function getTransactionStatus(
  txId: string
): Promise<"Pending" | "Finalized" | "Failed" | "Unknown"> {
  try {
    const response = await fetch(`${API_URL}/transaction/${txId}`);
    if (!response.ok) {
      if (response.status === 404) return "Pending";
      return "Unknown";
    }
    const data = await response.json();
    // Check if transaction is finalized
    if (data.type === "execute" || data.type === "deploy") {
      return "Finalized";
    }
    return "Finalized";
  } catch {
    return "Unknown";
  }
}

// Poll for transaction confirmation
export async function waitForConfirmation(
  txId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getTransactionStatus(txId);
    if (status === "Finalized") return true;
    if (status === "Failed") return false;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

// Get latest block height
export async function getLatestHeight(): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/latest/height`);
    if (!response.ok) return 0;
    return parseInt(await response.text());
  } catch {
    return 0;
  }
}

// Calculate payout for a winning bet
export function calculatePayout(
  betAmount: bigint,
  yesPool: bigint,
  noPool: bigint,
  outcome: boolean,
  winningOutcome: boolean
): bigint {
  if (outcome !== winningOutcome) return 0n;

  const totalPool = yesPool + noPool;
  const feeBps = 200n;
  const feeAmount = (totalPool * feeBps) / 10000n;
  const netPool = totalPool - feeAmount;
  const winningPool = winningOutcome ? yesPool : noPool;

  if (winningPool === 0n) return 0n;

  return (betAmount * netPool) / winningPool;
}

// Format microcredits to credits string
export function formatCredits(microcredits: bigint): string {
  const credits = Number(microcredits) / 1_000_000;
  return credits.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

// Format pool value for display
export function formatPool(microcredits: bigint): string {
  if (microcredits === 0n) return "0";
  const credits = Number(microcredits) / 1_000_000;
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}k`;
  }
  return credits.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
