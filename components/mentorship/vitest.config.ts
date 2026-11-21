import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../", import.meta.url)),
      "next/link": fileURLToPath(new URL("./test-link.ts", import.meta.url)),
    },
  },
  test: {
    include: ["components/mentorship/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
