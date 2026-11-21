import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { env as cloudflareEnv } from "cloudflare:workers";
import { appRouter } from "../../../../server/router";
import { openDatabase } from "../../../../server/db";
import { runtimeEnv } from "../../../../server/env";

async function handler(request: Request): Promise<Response> {
  const env = runtimeEnv(cloudflareEnv);
  let connection: Awaited<ReturnType<typeof openDatabase>>;
  try {
    connection = await openDatabase(env);
  } catch {
    return Response.json(
      { error: { message: "PostgreSQL is unavailable. Configure Hyperdrive or DATABASE_URL and retry.", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503 } } },
      { status: 503 },
    );
  }
  const responseHeaders = new Headers();
  try {
    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: () => ({ db: connection.db, env, request, responseHeaders }),
      responseMeta: ({ ctx }) => ({ headers: ctx?.responseHeaders ?? responseHeaders }),
    });
  } finally {
    await connection.close();
  }
}

export { handler as GET, handler as POST };
