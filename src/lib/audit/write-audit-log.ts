import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";

export { getAuditRequestMetadata } from "@/lib/audit/request-metadata";

export async function writeAuditLog(params: {
  action: AuditAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { metadata, ...rest } = params;
  await prisma.auditLog.create({
    data: {
      ...rest,
      ...(metadata !== undefined && {
        metadata: metadata as Prisma.InputJsonValue,
      }),
    },
  });
}

/**
 * Fire-and-forget audit log that logs failures instead of swallowing them silently.
 * Use for non-critical audit trails where the route should not fail if logging errors.
 */
export function fireAuditLog(params: {
  action: AuditAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  writeAuditLog(params).catch((error) => {
    logAppEvent(
      "error",
      "Audit log write failed",
      {
        source: "audit",
        action: params.action,
        userId: params.userId,
        targetId: params.targetId,
      },
      error,
    );
  });
}
