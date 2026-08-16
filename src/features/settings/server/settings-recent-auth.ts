import type { AuditAction } from "@/generated/prisma/client";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { resolveAuthoritativeRecentSession } from "@/lib/auth/recent-session";

export async function authorizeRecentSettingsAction(input: {
  action: AuditAction;
  request: Request;
  targetType: string;
  userId: string;
}) {
  const recent = await resolveAuthoritativeRecentSession(
    input.request.headers,
    {
      expectedUserId: input.userId,
    },
  );
  if (recent.ok) return recent;

  await fireAuditLog({
    action: input.action,
    channel: "web",
    outcome: "denied",
    subjectUserId: input.userId,
    targetType: input.targetType,
    userId: input.userId,
    ...(recent.sessionId ? { sessionId: recent.sessionId } : {}),
    metadata: { reason: recent.reason },
    ...getAuditRequestMetadata(input.request),
  });
  return recent;
}
