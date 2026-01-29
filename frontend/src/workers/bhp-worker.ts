// Lightweight worker for BHP256 hashing only.
// Imports from mainnet WASM (which has the binary — testnet is missing it).
// Does NOT call initThreadPool — not needed for hashing.

import { Plaintext, BHP256 } from "@provablehq/wasm/mainnet.js";
import { expose } from "comlink";

function computeBHP256Key(
  structName: "BettorKey" | "UserKey",
  fields: Record<string, string>
): string {
  let structLiteral: string;
  if (structName === "BettorKey") {
    structLiteral = `{ market_id: ${fields.market_id}, index: ${fields.index} }`;
  } else {
    structLiteral = `{ market_id: ${fields.market_id}, user: ${fields.user} }`;
  }

  const plaintext = Plaintext.fromString(structLiteral);
  const bits = plaintext.toBitsLe();
  const hasher = new BHP256();
  const hashField = hasher.hash(bits);
  return hashField.toString();
}

expose({ computeBHP256Key });
