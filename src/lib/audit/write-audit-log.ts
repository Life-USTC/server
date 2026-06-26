import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { recordAuditWriteMetric } from "@/lib/metrics/observability-metrics";
import { getRequestEvent } from "$app/server";

export { getAuditRequestMetadata } from "@/lib/audit/request-metadata";

type AuditLogParams = {
  action: AuditAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

type WorkerWaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type AuditPlatform = {
  context?: unknown;
  ctx?: unknown;
};

function isWorkerWaitUntilContext(
  value: unknown,
): value is WorkerWaitUntilContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "waitUntil" in value &&
    typeof value.waitUntil === "function"
  );
}

function getAuditWaitUntil() {
  try {
    const platform = getRequestEvent().platform as AuditPlatform | undefined;
    const context = platform?.ctx ?? platform?.context;
    if (!isWorkerWaitUntilContext(context)) return undefined;

    return (promise: Promise<unknown>) => {
      context.waitUntil(promise);
    };
  } catch {
    return undefined;
  }
}

function logAuditWriteFailure(params: AuditLogParams, error: unknown) {
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
}

export async function writeAuditLog(params: AuditLogParams) {
  const { metadata, ...rest } = params;
  const start = Date.now();
  try {
    await prisma.auditLog.create({
      data: {
        ...rest,
        ...(metadata !== undefined && {
          metadata: metadata as Prisma.InputJsonValue,
        }),
      },
    });
    recordAuditWriteMetric({
      action: params.action,
      status: "success",
      durationMs: Date.now() - start,
    });
  } catch (error) {
    recordAuditWriteMetric({
      action: params.action,
      status: "error",
      durationMs: Date.now() - start,
    });
    throw error;
  }
}

/**
 * Fire-and-forget audit log that logs failures instead of swallowing them silently.
 * Use for non-critical audit trails where the route should not fail if logging errors.
 * In Worker requests, the write is scheduled with waitUntil; outside that
 * context, the logged write promise is returned so callers can await it.
 */
export function fireAuditLog(params: AuditLogParams) {
  const waitUntil = getAuditWaitUntil();
  const auditWrite = writeAuditLog(params).catch((error: unknown) => {
    logAuditWriteFailure(params, error);
  });

  if (!waitUntil) return auditWrite;

  waitUntil(auditWrite);
  return undefined;
}
