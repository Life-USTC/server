import { getSessionFromHeaders } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { RECENT_AUTH_MAX_AGE_SECONDS } from "./recent-auth-policy";

export type AuthoritativeRecentSessionResult =
  | {
      ok: true;
      sessionId: string;
      userId: string;
    }
  | {
      ok: false;
      reason: "session_not_fresh" | "unauthenticated";
      sessionId?: string;
      userId?: string;
    };

export type AuthoritativeSessionResult =
  | { ok: true; sessionId: string; userId: string; createdAt: Date }
  | {
      ok: false;
      reason: "unauthenticated";
      sessionId?: string;
      userId?: string;
    };

/**
 * Re-reads the server-side session row before authorizing destructive account
 * work. The initial Better Auth read identifies the signed cookie, while the
 * second read prevents a cached or already-revoked session from authorizing it.
 */
export async function resolveAuthoritativeSession(
  headers: Headers,
  options: { expectedUserId?: string; now?: Date } = {},
): Promise<AuthoritativeSessionResult> {
  const resolved = await getSessionFromHeaders(headers);
  const sessionId = resolved?.session?.id;
  const userId = resolved?.user?.id;
  if (typeof sessionId !== "string" || typeof userId !== "string") {
    return { ok: false, reason: "unauthenticated" };
  }
  if (options.expectedUserId && options.expectedUserId !== userId) {
    return { ok: false, reason: "unauthenticated" };
  }

  const row = await authPrisma.session.findUnique({
    where: { id: sessionId },
    select: { createdAt: true, expires: true, userId: true },
  });
  const now = options.now ?? new Date();
  if (
    !row ||
    row.userId !== userId ||
    row.expires.getTime() <= now.getTime() ||
    !Number.isFinite(row.createdAt.getTime()) ||
    row.createdAt.getTime() > now.getTime()
  ) {
    return { ok: false, reason: "unauthenticated", sessionId, userId };
  }
  return { ok: true, sessionId, userId, createdAt: row.createdAt };
}

export async function resolveAuthoritativeRecentSession(
  headers: Headers,
  options: { expectedUserId?: string; now?: Date } = {},
): Promise<AuthoritativeRecentSessionResult> {
  const session = await resolveAuthoritativeSession(headers, options);
  if (!session.ok) return session;
  const { createdAt, sessionId, userId } = session;
  const now = options.now ?? new Date();
  if (
    now.getTime() - createdAt.getTime() >=
    RECENT_AUTH_MAX_AGE_SECONDS * 1000
  ) {
    return { ok: false, reason: "session_not_fresh", sessionId, userId };
  }
  return { ok: true, sessionId, userId };
}
