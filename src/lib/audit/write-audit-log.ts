import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { recordAuditWriteMetric } from "@/lib/metrics/observability-metrics";

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

type AuditLogClient = {
  auditLog: {
    create(args: Prisma.AuditLogCreateArgs): Promise<unknown>;
  };
};

type WorkerWaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type AuditPlatform = {
  context?: unknown;
  ctx?: unknown;
};

type AuditRequestEvent = {
  platform?: AuditPlatform;
};

type AuditServerModule = {
  getRequestEvent?: () => AuditRequestEvent;
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

async function loadAuditServerModule() {
  try {
    return (await import("$app/server")) as AuditServerModule;
  } catch {
    return undefined;
  }
}

async function getAuditWaitUntil() {
  try {
    const getRequestEvent = (await loadAuditServerModule())?.getRequestEvent;
    if (typeof getRequestEvent !== "function") return undefined;

    const platform = getRequestEvent().platform;
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

export async function writeAuditLog(
  params: AuditLogParams,
  client: AuditLogClient = prisma,
) {
  const { metadata, ...rest } = params;
  const start = Date.now();
  try {
    await client.auditLog.create({
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
 * In Worker requests, the write is also scheduled with waitUntil when the
 * SvelteKit request context is available. Awaiting this function guarantees
 * Worker waitUntil registration without waiting for the DB write. Outside a
 * Worker request, awaiting it waits for the logged write.
 */
export async function fireAuditLog(params: AuditLogParams) {
  const auditWrite = writeAuditLog(params).catch((error: unknown) => {
    logAuditWriteFailure(params, error);
  });

  const waitUntil = await getAuditWaitUntil();
  if (waitUntil) {
    waitUntil(auditWrite);
    return;
  }

  await auditWrite;
}
