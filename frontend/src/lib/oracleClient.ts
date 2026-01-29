// Browser-safe oracle helpers.
// The @zkportal/aleo-oracle-sdk is Node.js-only (uses net.isIP),
// so we use direct fetch calls for browser functionality.

import type { OraclePreset } from "./oraclePresets";

/**
 * Extract a value from a JSON object using a dot-separated selector path.
 * e.g. "data.amount" extracts obj.data.amount
 */
function extractBySelector(obj: unknown, selector: string): string | null {
  const parts = selector.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current != null ? String(current) : null;
}

/**
 * Test a preset's data source by fetching the URL and extracting via selector.
 * Returns the extracted value as a string, or throws on error.
 */
export async function testPresetSelector(
  preset: OraclePreset
): Promise<string> {
  const response = await fetch(preset.request.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const json = await response.json();
  const value = extractBySelector(json, preset.request.selector);
  if (value === null) {
    throw new Error(
      `Selector "${preset.request.selector}" returned no value from response.`
    );
  }
  return value;
}

/**
 * Notarize via the zkPortal oracle backend REST API directly.
 * This bypasses the Node.js SDK and calls the backend HTTP endpoint.
 *
 * Returns the request hash and attested data on success.
 */
const ORACLE_BACKEND = "https://sgx.aleooracle.xyz";

export async function notarizeRequest(preset: OraclePreset): Promise<{
  requestHash: string;
  attestedData: string;
  timestamp: number;
}> {
  const body = {
    url: preset.request.url,
    requestMethod: preset.request.requestMethod,
    selector: preset.request.selector,
    responseFormat: preset.request.responseFormat,
    encodingOptions: preset.request.encodingOptions,
  };

  const response = await fetch(`${ORACLE_BACKEND}/notarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Notarization failed (${response.status}): ${text || response.statusText}`
    );
  }

  const result = await response.json();

  // The backend returns oracleData with requestHash
  const oracleData = result.oracleData ?? result;
  const requestHash = oracleData.requestHash;
  const attestedData = result.attestationData ?? oracleData.userData ?? "";
  const timestamp = result.timestamp ?? 0;

  if (!requestHash) {
    throw new Error("Notarization response missing requestHash.");
  }

  return { requestHash, attestedData, timestamp };
}
