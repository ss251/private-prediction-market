/**
 * IndexedDB-backed store for commit-reveal bet nonces.
 *
 * Nonces are stored locally in IndexedDB — never sent to any server.
 * More secure than localStorage: structured cloning, not accessible
 * via simple string reads from injected scripts.
 *
 * @module
 */

const DB_NAME = "aleo-prediction-market";
const STORE_NAME = "commitments";
const DB_VERSION = 1;

/** A stored commitment awaiting reveal. */
export interface StoredCommitment {
  /** On-chain market ID (field string). */
  marketId: string;
  /** Bet direction: true = YES, false = NO. */
  direction: boolean;
  /** Bet amount in microcredits. */
  amount: number;
  /** Random nonce used to generate the commitment hash. */
  nonce: string;
  /** The commitment hash submitted on-chain. */
  commitHash: string;
  /** Transaction ID of the commit_bet transaction. */
  txId: string;
  /** Timestamp when the commitment was created. */
  createdAt: number;
  /** Whether this commitment has been revealed. */
  revealed: boolean;
}

/** Opens (or creates) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("marketId", "marketId", { unique: false });
        store.createIndex("revealed", "revealed", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Saves a commitment to IndexedDB. */
export async function saveCommitment(commitment: StoredCommitment): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(commitment);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieves all unrevealed commitments for a given market. */
export async function getUnrevealedCommitments(marketId: string): Promise<StoredCommitment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("marketId");
    const request = index.getAll(marketId);
    request.onsuccess = () => {
      const all = request.result as StoredCommitment[];
      resolve(all.filter((c: StoredCommitment) => !c.revealed));
    };
    request.onerror = () => reject(request.error);
  });
}

/** Marks a commitment as revealed in the store. */
export async function markRevealed(marketId: string, nonce: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("marketId");
    const request = index.getAll(marketId);
    request.onsuccess = () => {
      const all = request.result as (StoredCommitment & { id?: number })[];
      for (const c of all) {
        if (c.nonce === nonce && c.id !== undefined) {
          c.revealed = true;
          store.put(c);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
