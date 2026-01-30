import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run sequentially — contract tests depend on shared on-chain state
    sequence: { concurrent: false },
  },
});
