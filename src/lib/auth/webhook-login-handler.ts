import { timingSafeEqual } from "node:crypto";
import type { GenericEndpointContext } from "@better-auth/core";
import { setSessionCookie } from "better-auth/cookies";
import { getOptionalTrimmedEnv } from "@/app-env";
import { getAuditRequestMetadata } from "@/lib/audit/request-metadata";
import { fireAuditLog } from "@/lib/audit/write-audit-log";
import { authPrisma as prisma } from "@/lib/db/auth-prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

function jsonError(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function secretsEqual(provided: string | undefined, expected: string) {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

type WebhookLoginBody = {
  email?: string;
  secret?: string;
  userId?: string;
};

type WebhookLoginUser = {
  email?: string | null;
  id: string;
};

type WebhookLoginSession = {
  expiresAt: Date | string;
  token: string;
};

type WebhookLoginContext = {
  body: WebhookLoginBody;
  context: {
    internalAdapter: {
      createSession: (userId: string) => Promise<WebhookLoginSession>;
      findUserById: (userId: string) => Promise<WebhookLoginUser | null>;
    };
  };
  json: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  request?: Request;
};

export function isWebhookLoginEnabled() {
  const enabled = getOptionalTrimmedEnv("WEBHOOK_LOGIN_ENABLED");
  const secret = getOptionalTrimmedEnv("WEBHOOK_SECRET");
  return enabled === "true" && Boolean(secret);
}

export async function handleWebhookLogin(ctx: WebhookLoginContext) {
  const { secret, email, userId } = ctx.body;
  const webhookSecret = getOptionalTrimmedEnv("WEBHOOK_SECRET");
  if (!webhookSecret || !secretsEqual(secret, webhookSecret)) {
    logOAuthDebug("webhook-login.auth-failed", ctx.request, {
      reason: "invalid_or_missing_secret",
    });
    return jsonError(403, { error: "Forbidden" });
  }

  if (!email && !userId) {
    logOAuthDebug("webhook-login.missing-params", ctx.request, {
      reason: "neither_email_nor_userId_provided",
    });
    return jsonError(400, {
      error: "Either email or userId is required",
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(userId
          ? [{ id: userId }, { username: userId }, { name: userId }]
          : []),
      ],
    },
  });

  if (!user) {
    logOAuthDebug("webhook-login.user-not-found", ctx.request, {
      hasEmail: Boolean(email),
      hasUserId: Boolean(userId),
    });
    return jsonError(404, { error: "User not found" });
  }

  const authUser = await ctx.context.internalAdapter.findUserById(user.id);
  if (!authUser) {
    logOAuthDebug("webhook-login.user-missing-in-adapter", ctx.request, {
      reason: "adapter_lookup_miss",
    });
    return jsonError(404, { error: "User not found" });
  }

  const session = await ctx.context.internalAdapter.createSession(authUser.id);
  await setSessionCookie(ctx as unknown as GenericEndpointContext, {
    session: session as never,
    user: authUser as never,
  });

  const requestMeta = ctx.request ? getAuditRequestMetadata(ctx.request) : {};
  await fireAuditLog({
    action: "webhook_login",
    userId: authUser.id,
    targetId: authUser.id,
    targetType: "user",
    metadata: {
      lookup: email ? "email" : "userId",
    },
    ...requestMeta,
  });

  logOAuthDebug("webhook-login.success", ctx.request, {});

  return ctx.json({
    ok: true,
    userId: authUser.id,
    email: authUser.email,
    expires: new Date(session.expiresAt).toISOString(),
  });
}
