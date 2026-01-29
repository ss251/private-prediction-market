// Singleton wrapper for the BHP256 hash worker (bhp-worker.ts).
// Separate from AleoWorker to avoid the broken testnet WASM binary.

import { wrap, type Remote } from "comlink";

interface HashWorkerAPI {
  computeBHP256Key(
    structName: "BettorKey" | "UserKey",
    fields: Record<string, string>
  ): Promise<string>;
}

let singleton: Remote<HashWorkerAPI> | null = null;

export const HashWorker = (): Remote<HashWorkerAPI> => {
  if (!singleton) {
    const worker = new Worker(new URL("./bhp-worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onerror = (event) => {
      console.error("HashWorker error:", event?.message);
    };

    singleton = wrap<HashWorkerAPI>(worker);
  }
  return singleton;
};
