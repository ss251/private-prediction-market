/**
 * Wrapper for executing `leo run` commands against the local contract.
 * Used by contract transition tests.
 */

import { execSync } from "node:child_process";
import { CONTRACT_DIR } from "./constants";

const CONTRACT_PATH = CONTRACT_DIR;

export interface LeoRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  /** Parsed output section (after "Output") */
  output: string;
}

/**
 * Run a Leo transition locally (no proofs, no finalize).
 * Returns structured result with stdout/stderr.
 */
export function leoRun(
  transition: string,
  args: string[],
  options?: { privateKey?: string }
): LeoRunResult {
  const argsStr = args.join(" ");
  let cmd = `leo run ${transition} ${argsStr}`;

  // Optionally override private key for caller identity
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PATH: process.env.PATH || "",
  };
  if (options?.privateKey) {
    env.PRIVATE_KEY = options.privateKey;
  }

  try {
    const stdout = execSync(cmd, {
      cwd: CONTRACT_PATH,
      encoding: "utf-8",
      timeout: 60_000,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Extract output section
    const outputMatch = stdout.match(/➡️\s*Output\s*\n([\s\S]*?)$/);
    const output = outputMatch ? outputMatch[1].trim() : "";

    return { success: true, stdout, stderr: "", output };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "",
      output: "",
    };
  }
}

/**
 * Assert that a leo run succeeds.
 */
export function expectLeoRunSuccess(
  transition: string,
  args: string[],
  options?: { privateKey?: string }
): LeoRunResult {
  const result = leoRun(transition, args, options);
  if (!result.success) {
    throw new Error(
      `leo run ${transition} failed:\n${result.stderr}\n${result.stdout}`
    );
  }
  return result;
}

/**
 * Assert that a leo run fails (for negative tests).
 */
export function expectLeoRunFailure(
  transition: string,
  args: string[],
  options?: { privateKey?: string }
): LeoRunResult {
  const result = leoRun(transition, args, options);
  if (result.success) {
    throw new Error(
      `leo run ${transition} was expected to fail but succeeded:\n${result.output}`
    );
  }
  return result;
}
