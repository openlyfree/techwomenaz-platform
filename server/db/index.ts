import { Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { RuntimeEnv } from "../env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function openDatabase(env: RuntimeEnv): Promise<{ db: Database; close: () => Promise<void> }> {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("PostgreSQL is not configured. Bind Hyperdrive or set DATABASE_URL for local development.");
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end();
    },
  };
}
