/**
 * Commit-reveal betting helpers.
 * Manages commitment nonces in localStorage and provides hash generation
 * for the two-phase betting protocol.
 * @module
 */

const LS_KEY = "ppm_commitments";

/** A pending commitment stored in localStorage. */
export interface PendingCommitment {
  marketId: string;
  direction: boolean;
  amount: number; // microcredits
  nonce: string; // field value
  commitTxId: string;
  timestamp: number;
  status: "committed" | "revealed" | "reclaimed";
}

/** Read all pending commitments from localStorage. */
export function getCommitments(): PendingCommitment[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingCommitment[];
  } catch {
    return [];
  }
}

/** Save a new commitment to localStorage. */
export function saveCommitment(commitment: PendingCommitment): void {
  const existing = getCommitments();
  existing.push(commitment);
  localStorage.setItem(LS_KEY, JSON.stringify(existing));
}

/** Update a commitment's status. */
export function updateCommitmentStatus(
  nonce: string,
  status: PendingCommitment["status"]
): void {
  const commitments = getCommitments();
  const updated = commitments.map((c) =>
    c.nonce === nonce ? { ...c, status } : c
  );
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
}

/** Get pending (unrevealed) commitments for a market. */
export function getPendingCommitments(marketId: string): PendingCommitment[] {
  const normalizedId = marketId.replace(/field$/, "");
  return getCommitments().filter(
    (c) =>
      c.marketId.replace(/field$/, "") === normalizedId &&
      c.status === "committed"
  );
}

/**
 * Generate a random nonce for commitment.
 * Returns a field-compatible random value.
 */
export function generateNonce(): string {
  const array = new Uint8Array(31); // 248 bits, safe for field
  crypto.getRandomValues(array);
  let value = 0n;
  for (const byte of array) {
    value = (value << 8n) | BigInt(byte);
  }
  return `${value}field`;
}

/**
 * Build the commitment hash input string for the Leo contract.
 * The contract uses BHP256::hash_to_field on the Commitment struct.
 * This returns the struct literal for the SDK.
 */
export function buildCommitmentInput(
  marketId: string,
  direction: boolean,
  amount: number,
  nonce: string
): string {
  return `{ market_id: ${marketId}, direction: ${direction}, amount: ${amount}u64, nonce: ${nonce} }`;
}
