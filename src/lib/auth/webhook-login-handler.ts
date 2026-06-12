import type { GenericEndpointContext } from "@better-auth/core";
import { setSessionCookie } from "better-auth/cookies";
import { getOptionalTrimmedEnv } from "@/app-env";
import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

function jsonError(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
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

export async function handleWebhookLogin(ctx: WebhookLoginContext) {
  const { secret, email, userId } = ctx.body;
  const webhookSecret = getOptionalTrimmedEnv("WEBHOOK_SECRET");
  if (!webhookSecret || secret !== webhookSecret) {
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
      userId: user.id,
    });
    return jsonError(404, { error: "User not found" });
  }

  const session = await ctx.context.internalAdapter.createSession(authUser.id);
  await setSessionCookie(ctx as unknown as GenericEndpointContext, {
    session: session as never,
    user: authUser as never,
  });

  logOAuthDebug("webhook-login.success", ctx.request, {
    userId: authUser.id,
  });

  return ctx.json({
    ok: true,
    userId: authUser.id,
    email: authUser.email,
    sessionToken: session.token,
    expires: new Date(session.expiresAt).toISOString(),
  });
}
