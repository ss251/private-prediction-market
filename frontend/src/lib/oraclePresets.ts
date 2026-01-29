// Preset oracle data sources for market creation
// Each preset defines an API endpoint, selector, and encoding options
// that the zkPortal oracle SDK can use for attestation.
//
// Note: The SDK types are not imported directly because the SDK is Node.js only.
// These types mirror the relevant subset of AttestationRequest.

export interface OracleRequestConfig {
  url: string;
  requestMethod: string;
  selector: string;
  responseFormat: string;
  encodingOptions: {
    value: string;
    precision: number;
  };
}

export interface OraclePreset {
  id: string;
  name: string;
  category: string;
  request: OracleRequestConfig;
  thresholdLabel: string;
  thresholdUnit: string;
}

export const ORACLE_PRESETS: OraclePreset[] = [
  {
    id: "btc_binance",
    name: "Bitcoin Price (Binance)",
    category: "crypto",
    request: {
      url: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      requestMethod: "GET",
      selector: "price",
      responseFormat: "json",
      encodingOptions: {
        value: "float",
        precision: 2,
      },
    },
    thresholdLabel: "Target USD price",
    thresholdUnit: "$",
  },
  {
    id: "eth_binance",
    name: "Ethereum Price (Binance)",
    category: "crypto",
    request: {
      url: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
      requestMethod: "GET",
      selector: "price",
      responseFormat: "json",
      encodingOptions: {
        value: "float",
        precision: 2,
      },
    },
    thresholdLabel: "Target USD price",
    thresholdUnit: "$",
  },
  {
    id: "btc_coinbase",
    name: "Bitcoin Price (Coinbase)",
    category: "crypto",
    request: {
      url: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
      requestMethod: "GET",
      selector: "data.amount",
      responseFormat: "json",
      encodingOptions: {
        value: "float",
        precision: 2,
      },
    },
    thresholdLabel: "Target USD price",
    thresholdUnit: "$",
  },
  {
    id: "sol_binance",
    name: "Solana Price (Binance)",
    category: "crypto",
    request: {
      url: "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
      requestMethod: "GET",
      selector: "price",
      responseFormat: "json",
      encodingOptions: {
        value: "float",
        precision: 2,
      },
    },
    thresholdLabel: "Target USD price",
    thresholdUnit: "$",
  },
];

/**
 * Convert a human-readable price to a threshold value for the oracle.
 * The oracle encodes floats by multiplying by 10^precision and truncating.
 *
 * Example: $150,000 with precision 2 => 15000000n
 */
export function humanPriceToThreshold(
  price: number,
  precision: number
): bigint {
  const multiplier = 10 ** precision;
  return BigInt(Math.round(price * multiplier));
}

/**
 * Convert a threshold value back to a human-readable price.
 *
 * Example: 15000000n with precision 2 => 150000
 */
export function thresholdToHumanPrice(
  threshold: bigint,
  precision: number
): number {
  const multiplier = 10 ** precision;
  return Number(threshold) / multiplier;
}

/**
 * Find a preset by its ID.
 */
export function getPresetById(id: string): OraclePreset | undefined {
  return ORACLE_PRESETS.find((p) => p.id === id);
}
