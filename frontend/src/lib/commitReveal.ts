/**
 * Commit-reveal betting helpers.
 * Manages commitment nonces in IndexedDB and provides hash generation
 * for the two-phase betting protocol.
 *
 * IndexedDB is used instead of localStorage because nonces are critical —
 * losing a nonce means locked credits cannot be revealed or reclaimed.
 * IndexedDB is more durable, supports structured data, and doesn't get
 * wiped by browser storage pressure like localStorage can.
 * @module
 */

const DB_NAME = "ppm_commitments";
const DB_VERSION = 1;
const STORE_NAME = "commitments";

/** A pending commitment stored in IndexedDB. */
export interface PendingCommitment {
  marketId: string;
  direction: boolean;
  amount: number; // microcredits
  nonce: string; // field value (primary key)
  commitTxId: string;
  timestamp: number;
  status: "committed" | "revealed" | "reclaimed";
}

/** Open (or create) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "nonce" });
        store.createIndex("by_market", "marketId", { unique: false });
        store.createIndex("by_status", "status", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Read all commitments from IndexedDB. */
export async function getCommitments(): Promise<PendingCommitment[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as PendingCommitment[]);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/** Save a new commitment to IndexedDB. */
export async function saveCommitment(commitment: PendingCommitment): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(commitment);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update a commitment's status by nonce. */
export async function updateCommitmentStatus(
  nonce: string,
  status: PendingCommitment["status"]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(nonce);
    getReq.onsuccess = () => {
      const existing = getReq.result as PendingCommitment | undefined;
      if (existing) {
        store.put({ ...existing, status });
      }
      tx.oncomplete = () => resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Get pending (unrevealed) commitments for a market. */
export async function getPendingCommitments(marketId: string): Promise<PendingCommitment[]> {
  const normalizedId = marketId.replace(/field$/, "");
  const all = await getCommitments();
  return all.filter(
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
