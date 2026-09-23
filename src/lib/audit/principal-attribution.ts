import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { AuditChannel } from "@/generated/prisma/client";
import type { ApiPrincipal } from "@/lib/auth/api-auth";
import type { GraphqlPrincipal } from "@/lib/graphql/auth";

export type AuditPrincipalAttribution = {
  channel: AuditChannel;
  userId?: string;
  subjectUserId?: string;
  oauthClientId?: string;
  oauthGrantId?: string;
  sessionId?: string;
};

function oauthAttribution(input: {
  channel: "rest" | "graphql" | "mcp";
  userId: string;
  clientId?: string;
  grantId?: string;
  sessionId?: string;
}): AuditPrincipalAttribution {
  return {
    channel: input.channel,
    userId: input.userId,
    subjectUserId: input.userId,
    ...(input.clientId ? { oauthClientId: input.clientId } : {}),
    ...(input.grantId ? { oauthGrantId: input.grantId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  };
}

export function attributionFromApiPrincipal(
  principal: ApiPrincipal,
): AuditPrincipalAttribution {
  if (principal.kind === "oauth") {
    return oauthAttribution({
      channel: "rest",
      userId: principal.userId,
      clientId: principal.clientId,
      grantId: principal.grantId,
      sessionId: principal.sessionId,
    });
  }
  return {
    channel: "rest",
    userId: principal.userId,
    subjectUserId: principal.userId,
    ...(principal.sessionId ? { sessionId: principal.sessionId } : {}),
  };
}

export function attributionFromGraphqlPrincipal(
  principal: Exclude<GraphqlPrincipal, { kind: "anonymous" }>,
): AuditPrincipalAttribution {
  if (principal.kind === "oauth") {
    return oauthAttribution({
      channel: principal.channel ?? "graphql",
      userId: principal.userId,
      clientId: principal.clientId,
      grantId: principal.grantId,
      sessionId: principal.sessionId,
    });
  }
  return {
    channel: "graphql",
    userId: principal.userId,
    subjectUserId: principal.userId,
    ...(principal.sessionId ? { sessionId: principal.sessionId } : {}),
  };
}

export function attributionFromMcpAuthInfo(
  authInfo: AuthInfo,
): AuditPrincipalAttribution | null {
  const userId = authInfo.extra?.userId;
  if (typeof userId !== "string" || !userId) return null;
  const grantId = authInfo.extra?.grantId;
  const sessionId = authInfo.extra?.sessionId;
  return oauthAttribution({
    channel: "mcp",
    userId,
    clientId: authInfo.clientId,
    grantId: typeof grantId === "string" ? grantId : undefined,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
  });
}
