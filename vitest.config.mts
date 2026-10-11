import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/core/**/*.ts"],
      exclude: ["src/lib/core/**/*.test.ts"],
      reporter: ["text-summary", "text"],
      // BUILD_PLAN Fase 1: cakupan baris src/lib/core >= 90%
      thresholds: { lines: 90 },
    },
  },
});
