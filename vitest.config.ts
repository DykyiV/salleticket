import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "file:/tmp/asol-test.db",
    },
    globalSetup: ["tests/globalSetup.ts"],
    // Integration files share one SQLite file — run files sequentially.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
