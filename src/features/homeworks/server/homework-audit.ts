import type { AuditChannel } from "@/generated/prisma/client";

export type HomeworkAuditContext = {
  channel?: AuditChannel;
  oauthClientId?: string;
  oauthGrantId?: string;
  requestId?: string;
  sessionId?: string;
};

export function homeworkAuditAttribution(
  userId: string,
  context: HomeworkAuditContext | undefined,
) {
  return {
    channel: context?.channel ?? ("web" as const),
    userId,
    subjectUserId: userId,
    ...(context?.oauthClientId ? { oauthClientId: context.oauthClientId } : {}),
    ...(context?.oauthGrantId ? { oauthGrantId: context.oauthGrantId } : {}),
    ...(context?.requestId ? { requestId: context.requestId } : {}),
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
  };
}
