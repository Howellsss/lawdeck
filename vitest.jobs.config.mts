import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One-off ADMIN JOBS (jobs/*.job.ts), run by hand from GitHub Actions with the service key.
// Vitest is only the runner here (it already understands the project's TypeScript and paths),
// so no extra tool is needed.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/serverOnlyStub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["jobs/**/*.job.ts"],
    environment: "node",
    testTimeout: 30 * 60_000,
    fileParallelism: false,
  },
});
