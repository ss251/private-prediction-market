/**
 * localStorage-based position tracking for user bets.
 * Avoids wallet popup from `requestRecords()` by caching bet details locally
 * when a bet is placed. On-chain verification remains available as an explicit action.
 * @module
 */

const LS_KEY = "ppm_user_positions";

/** A locally-tracked bet position. */
export interface LocalPosition {
  marketId: string;
  outcome: boolean;
  amount: number; // microcredits
  txId: string;
  timestamp: number;
}

/** Read all locally-tracked positions from localStorage. */
export function getLocalPositions(): LocalPosition[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalPosition[];
  } catch {
    return [];
  }
}

/** Save a new bet position to localStorage. */
export function saveLocalPosition(position: LocalPosition): void {
  const existing = getLocalPositions();
  existing.push(position);
  localStorage.setItem(LS_KEY, JSON.stringify(existing));
}

/** Get aggregated positions for specific market IDs. */
export function getLocalPositionsForMarkets(
  marketIds: string[]
): { marketId: string; yesAmount: bigint; noAmount: bigint }[] {
  const positions = getLocalPositions();
  const normalizedIds = marketIds.map((id) => id.replace(/field$/, ""));

  const byMarket = new Map<string, { yes: bigint; no: bigint }>();

  for (const pos of positions) {
    const normalizedId = pos.marketId.replace(/field$/, "");
    if (!normalizedIds.includes(normalizedId)) continue;

    const existing = byMarket.get(normalizedId) ?? { yes: 0n, no: 0n };
    if (pos.outcome) {
      existing.yes += BigInt(pos.amount);
    } else {
      existing.no += BigInt(pos.amount);
    }
    byMarket.set(normalizedId, existing);
  }

  return Array.from(byMarket.entries()).map(([marketId, amounts]) => ({
    marketId,
    yesAmount: amounts.yes,
    noAmount: amounts.no,
  }));
}

/** Clear positions for a specific market (e.g., after claim/refund). */
export function clearLocalPositions(marketId: string): void {
  const normalizedId = marketId.replace(/field$/, "");
  const positions = getLocalPositions().filter(
    (p) => p.marketId.replace(/field$/, "") !== normalizedId
  );
  localStorage.setItem(LS_KEY, JSON.stringify(positions));
}
