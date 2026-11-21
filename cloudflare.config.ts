import { bindings, defineConfig, defineWorker } from "cf/config";
import { config as loadLocalEnv } from "dotenv";

loadLocalEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  worker: defineWorker({
    name: "techwomenaz-platform",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-21",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      HYPERDRIVE: bindings.hyperdrive({
        id: "db919459750842bba0449de7adfa0c5a",
        dev: { connectionString: process.env.DATABASE_URL },
      }),
      AI: bindings.ai(),
      DEMO_MODE: bindings.text("true"),
    },
    workersDev: true,
    previewUrls: true,
    observability: {
      enabled: true,
      logs: { enabled: true, persist: true },
      traces: { enabled: true, headSamplingRate: 0.25, persist: true },
    },
  }),
});
