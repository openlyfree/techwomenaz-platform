import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { SessionUser } from "../lib/contracts";
import { appOrigin, type RuntimeEnv } from "./env";
import type { Database } from "./db";
import { authTokens, members, sessions } from "./db/schema";
import {
  createOpaqueToken,
  hashAuthToken,
  magicTokenIsUsable,
  memberCanAuthenticate,
  normalizeEmail,
  sessionIsActive,
} from "./auth-utils";

export const SESSION_COOKIE = "twaz_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAGIC_TOKEN_SECONDS = 15 * 60;

/** Injectable boundaries keep the clock and email transport out of unit tests. */
export interface AuthDeliveryOptions {
  now?: () => Date;
  token?: () => string;
  deliver?: (env: RuntimeEnv, message: { from: string; to: string; raw: string }) => Promise<void>;
}

/**
 * Production email delivery. The dynamic import stays Workers-safe and is only
 * evaluated at request time (never during module load or in unit tests).
 */
async function deliverMagicEmail(
  env: RuntimeEnv,
  message: { from: string; to: string; raw: string },
): Promise<void> {
  const { EmailMessage } = await import("cloudflare:email");
  await env.EMAIL!.send(new EmailMessage(message.from, message.to, message.raw));
}

function magicEmail(from: string, to: string, url: string): string {
  const subject = "Your TechWomenAZ sign-in link";
  const text = `Use this single-use link within 15 minutes to sign in to TechWomenAZ: ${url}\r\nIf you did not request it, ignore this email.`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
  ].join("\r\n");
}

export async function sendMagicLink(
  db: Database,
  env: RuntimeEnv,
  request: Request,
  emailInput: string,
  options: AuthDeliveryOptions = {},
): Promise<void> {
  const email = normalizeEmail(emailInput);
  const now = (options.now ?? (() => new Date()))();
  if (!env.EMAIL || !env.EMAIL_FROM) {
    throw new Error("Email sending is not configured. Configure EMAIL_FROM and the Cloudflare EMAIL binding; no sign-in link was sent.");
  }
  const recent = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authTokens)
    .where(and(eq(authTokens.email, email), gt(authTokens.createdAt, new Date(now.getTime() - 60 * 60 * 1000))));
  if ((recent[0]?.count ?? 0) >= 5) {
    throw new Error("Too many sign-in links were requested for this account. Please try again later.");
  }

  const token = (options.token ?? createOpaqueToken)();
  const tokenHash = await hashAuthToken(token);
  await db.insert(authTokens).values({
    id: crypto.randomUUID(),
    tokenHash,
    email,
    expiresAt: new Date(now.getTime() + MAGIC_TOKEN_SECONDS * 1000),
  });
  const url = `${appOrigin(env, request)}/api/auth/verify?token=${encodeURIComponent(token)}`;
  try {
    await (options.deliver ?? deliverMagicEmail)(env, {
      from: env.EMAIL_FROM,
      to: email,
      raw: magicEmail(env.EMAIL_FROM, email, url),
    });
  } catch {
    throw new Error("The configured email transport could not send the sign-in link. Please try again after email delivery is repaired.");
  }
}

export async function verifyMagicLink(
  db: Database,
  rawToken: string,
  options: { now?: () => Date } = {},
): Promise<{ sessionToken: string; memberId: string }> {
  if (!rawToken || rawToken.length > 256) throw new Error("This sign-in link is invalid. Request a new link.");
  const now = (options.now ?? (() => new Date()))();
  const tokenHash = await hashAuthToken(rawToken);
  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: authTokens.id, email: authTokens.email, consumedAt: authTokens.consumedAt, expiresAt: authTokens.expiresAt })
      .from(authTokens)
      .where(and(eq(authTokens.tokenHash, tokenHash), isNull(authTokens.consumedAt), gt(authTokens.expiresAt, now)))
      .limit(1);
    const claim = found[0];
    if (!magicTokenIsUsable(claim, now)) throw new Error("This sign-in link is invalid, used, or expired. Request a new link.");
    const memberRows = await tx.select().from(members).where(eq(members.email, claim.email)).limit(1);
    const member = memberRows[0];
    if (!member) throw new Error("No membership application exists for this email. Submit an application first.");
    if (!memberCanAuthenticate(member)) throw new Error("This account is paused or unavailable. Contact a coordinator.");
    const consumed = await tx
      .update(authTokens)
      .set({ consumedAt: now })
      .where(and(eq(authTokens.id, claim.id), isNull(authTokens.consumedAt)))
      .returning({ id: authTokens.id });
    if (!consumed.length) throw new Error("This sign-in link was already used. Request a new link.");
    if (!member.emailVerifiedAt) {
      await tx.update(members).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(members.id, member.id));
    }
    const sessionToken = createOpaqueToken();
    await tx.insert(sessions).values({
      id: crypto.randomUUID(),
      tokenHash: await hashAuthToken(sessionToken),
      memberId: member.id,
      expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
    });
    return { sessionToken, memberId: member.id };
  });
}

function cookieToken(request: Request): string | null {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export async function getSessionUser(
  db: Database,
  request: Request,
  options: { now?: () => Date } = {},
): Promise<SessionUser | null> {
  const now = (options.now ?? (() => new Date()))();
  const token = cookieToken(request);
  if (!token || token.length > 256) return null;
  const tokenHash = await hashAuthToken(token);
  const rows = await db
    .select({
      id: members.id, name: members.name, email: members.email, role: members.role,
      status: members.status, sessionId: sessions.id, sessionExpiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(members, eq(sessions.memberId, members.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  const user = rows[0];
  if (!user || !sessionIsActive(user.sessionExpiresAt, now) || !memberCanAuthenticate(user)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function destroySession(db: Database, request: Request): Promise<void> {
  const token = cookieToken(request);
  if (!token || token.length > 256) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, await hashAuthToken(token)));
}

/** Only a plain-HTTP loopback development origin may omit Secure. Fail safe otherwise. */
function secureCookieFlag(request: Request, env: RuntimeEnv): string {
  const origin = appOrigin(env, request);
  let loopback = false;
  try {
    const url = new URL(origin);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    loopback = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    // An unparseable origin is never a reason to weaken the cookie.
  }
  return origin.startsWith("https://") || !loopback ? "; Secure" : "";
}

export function sessionCookie(token: string, request: Request, env: RuntimeEnv): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secureCookieFlag(request, env)}`;
}

export function clearSessionCookie(request: Request, env: RuntimeEnv): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieFlag(request, env)}`;
}
