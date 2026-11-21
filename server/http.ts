import type { RuntimeEnv } from "./env";
import { openDatabase, type Database } from "./db";

export async function withDatabase<T>(env: RuntimeEnv, run: (db: Database) => Promise<T>): Promise<T> {
  const connection = await openDatabase(env);
  try {
    return await run(connection.db);
  } finally {
    await connection.close();
  }
}

export function safeNextPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/portal";
}
