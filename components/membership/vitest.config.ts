import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
  },
  test: {
    include: ["components/membership/**/*.test.ts"],
    environment: "node",
    coverage: { reporter: ["text", "json-summary"] },
  },
});
