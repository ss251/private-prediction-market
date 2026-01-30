// ── Contract constants (must match main.leo) ──

export const PROGRAM_ID = "prediction_market_test004.aleo";
export const API_BASE = "https://api.explorer.provable.com/v1";
export const NETWORK = "testnet";

// Status codes
export const STATUS_OPEN = 0;
export const STATUS_CLOSED = 1;
export const STATUS_RESOLVED = 2;
export const STATUS_CANCELLED = 3;

// Fee: 2% = 200 basis points
export const FEE_BPS = 200n;
export const BPS_DENOMINATOR = 10_000n;

// Minimum bet: 0.001 credits = 1000 microcredits
export const MIN_BET = 1000n;

// Admin address (derived from contract .env private key)
export const ADMIN_ADDRESS =
  "aleo1vuxp3mgw9tq25wzwwdn5vfrym45p444fq7rf9s4krd3rmne7xupqzl906l";

// Contract directory for leo run (absolute path)
export const CONTRACT_DIR =
  "/Users/sailesh/Developer/aleo/private-prediction-market/contracts/prediction_market";
