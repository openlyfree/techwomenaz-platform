import { env as cloudflareEnv } from "cloudflare:workers";
import { verifyMagicLink, sessionCookie } from "../../../../server/auth";
import { withDatabase, safeNextPath } from "../../../../server/http";
import { appOrigin, runtimeEnv } from "../../../../server/env";

export async function GET(request: Request): Promise<Response> {
  const env = runtimeEnv(cloudflareEnv);
  const url = new URL(request.url);
  try {
    const result = await withDatabase(env, (db) => verifyMagicLink(db, url.searchParams.get("token") || ""));
    const headers = new Headers({
      location: `${appOrigin(env, request)}${safeNextPath(url.searchParams.get("next"))}`,
      "set-cookie": sessionCookie(result.sessionToken, request, env),
      "cache-control": "no-store",
    });
    return new Response(null, { status: 302, headers });
  } catch {
    const message = "This sign-in link is invalid, used, expired, or unavailable. Request a new link.";
    return Response.redirect(`${appOrigin(env, request)}/login?error=${encodeURIComponent(message)}`, 302);
  }
}
