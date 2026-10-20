import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for plain logic (tests/unit). Browser journeys live in tests/e2e (Playwright).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" blocks browser bundles; in tests it is a harmless empty module.
      "server-only": fileURLToPath(new URL("./tests/unit/serverOnlyStub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
