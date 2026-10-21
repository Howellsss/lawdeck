import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// AI quality tests (tests/eval). They call real services and cost a little, so they run on
// demand (npm run eval:retrieval, or the "Retrieval test" workflow on GitHub), not on every change.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/serverOnlyStub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/eval/**/*.eval.ts"],
    environment: "node",
    testTimeout: 55 * 60_000, // Voyage free tier: about 10,000 tokens a minute, so a full run can take most of an hour.
    fileParallelism: false,
  },
});
