import { defineConfig } from "vitest/config";

// Permission tests against the real Supabase project. See tests/permissions/README.md.
export default defineConfig({
  test: {
    include: ["tests/permissions/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
