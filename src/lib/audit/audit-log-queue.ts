import {
  AuditAction,
  AuditChannel,
  AuditOutcome,
} from "@/generated/prisma/client";
import type { AuditLogParams } from "@/lib/audit/write-audit-log";
import { writeAuditLogs } from "@/lib/audit/write-audit-log";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import { writeQueueBatchAnalytics } from "@/lib/metrics/analytics-engine";

export const AUDIT_LOG_WRITE_QUEUE_NAME = "life-ustc-audit-log-write";

export type AuditLogWriteQueueMessage = {
  auditId: string;
  params: Omit<AuditLogParams, "id">;
  type: "audit-log.write.v1";
};

type QueueMessage = {
  ack(): void;
  body: unknown;
  attempts?: number;
  id?: string;
  retry(): void;
  timestamp?: Date;
};

const AUDIT_ACTIONS = new Set(Object.values(AuditAction));
const AUDIT_CHANNELS = new Set(Object.values(AuditChannel));
const AUDIT_OUTCOMES = new Set(Object.values(AuditOutcome));

export const AUDIT_LOG_METADATA_LIMITS = {
  maxDepth: 4,
  maxEntries: 64,
  maxSerializedBytes: 8 * 1024,
} as const;

const AUDIT_PARAM_KEYS = new Set([
  "action",
  "channel",
  "ipAddress",
  "metadata",
  "oauthClientId",
  "oauthGrantId",
  "outcome",
  "requestId",
  "sessionId",
  "subjectUserId",
  "targetId",
  "targetType",
  "userAgent",
  "userId",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength;
}

function validOptionalString(value: unknown, maxLength: number) {
  return value === undefined || boundedString(value, maxLength);
}

const INVALID_METADATA = Symbol("invalid-audit-metadata");

function boundedAuditMetadata(value: unknown): Record<string, unknown> | null {
  let entries = 0;
  const ancestors = new WeakSet<object>();

  const visit = (
    candidate: unknown,
    depth: number,
  ): unknown | typeof INVALID_METADATA => {
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean"
    ) {
      return candidate;
    }
    if (typeof candidate === "number") {
      return Number.isFinite(candidate) ? candidate : INVALID_METADATA;
    }
    if (typeof candidate !== "object") return INVALID_METADATA;
    if (depth >= AUDIT_LOG_METADATA_LIMITS.maxDepth) {
      return INVALID_METADATA;
    }
    if (ancestors.has(candidate)) return INVALID_METADATA;
    ancestors.add(candidate);

    try {
      if (Array.isArray(candidate)) {
        const output: unknown[] = [];
        for (const item of candidate) {
          entries += 1;
          if (entries > AUDIT_LOG_METADATA_LIMITS.maxEntries) {
            return INVALID_METADATA;
          }
          const normalized = visit(item, depth + 1);
          if (normalized === INVALID_METADATA) return INVALID_METADATA;
          output.push(normalized);
        }
        return output;
      }

      const record = candidate as Record<string, unknown>;
      const output = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        entries += 1;
        if (entries > AUDIT_LOG_METADATA_LIMITS.maxEntries) {
          return INVALID_METADATA;
        }
        const normalized = visit(record[key], depth + 1);
        if (normalized === INVALID_METADATA) return INVALID_METADATA;
        output[key] = normalized;
      }
      return output;
    } finally {
      ancestors.delete(candidate);
    }
  };

  const normalized = visit(value, 0);
  if (
    normalized === INVALID_METADATA ||
    normalized === null ||
    Array.isArray(normalized) ||
    typeof normalized !== "object"
  ) {
    return null;
  }

  try {
    const serialized = JSON.stringify(normalized);
    if (serialized === undefined) return null;
    if (
      new TextEncoder().encode(serialized).byteLength >
      AUDIT_LOG_METADATA_LIMITS.maxSerializedBytes
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return normalized as Record<string, unknown>;
}

function parseAuditParams(value: unknown): Omit<AuditLogParams, "id"> | null {
  if (!isRecord(value)) return null;
  const metadata =
    value.metadata === undefined
      ? undefined
      : boundedAuditMetadata(value.metadata);
  if (
    [...Object.keys(value)].some((key) => !AUDIT_PARAM_KEYS.has(key)) ||
    !AUDIT_ACTIONS.has(value.action as AuditAction) ||
    !validOptionalString(value.userId, 128) ||
    !validOptionalString(value.subjectUserId, 128) ||
    !validOptionalString(value.oauthClientId, 128) ||
    !validOptionalString(value.oauthGrantId, 128) ||
    !validOptionalString(value.sessionId, 128) ||
    !validOptionalString(value.requestId, 128) ||
    !validOptionalString(value.targetId, 256) ||
    !validOptionalString(value.targetType, 128) ||
    !validOptionalString(value.ipAddress, 64) ||
    !validOptionalString(value.userAgent, 512) ||
    (value.channel !== undefined &&
      !AUDIT_CHANNELS.has(value.channel as AuditChannel)) ||
    (value.outcome !== undefined &&
      !AUDIT_OUTCOMES.has(value.outcome as AuditOutcome)) ||
    (value.metadata !== undefined && metadata === null)
  ) {
    return null;
  }
  if (metadata === null) return null;

  return {
    ...(value as Omit<AuditLogParams, "id">),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

export type AuditLogWriteQueueBatch = {
  messages: readonly QueueMessage[];
};

export type AuditLogWriteQueueBatchReport = {
  acked: number;
  invalid: number;
  maxAgeMs: number;
  maxAttempts: number;
  processed: number;
  retried: number;
};

export function parseAuditLogWriteQueueMessage(
  value: unknown,
): AuditLogWriteQueueMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as {
    auditId?: unknown;
    params?: unknown;
    type?: unknown;
  };
  const params = parseAuditParams(message.params);
  if (
    message.type !== "audit-log.write.v1" ||
    typeof message.auditId !== "string" ||
    message.auditId.length < 1 ||
    message.auditId.length > 128 ||
    !params
  ) {
    return null;
  }
  return {
    auditId: message.auditId,
    params,
    type: "audit-log.write.v1",
  };
}

function logInvalidAuditMessage() {
  logAppEvent("error", "audit-log-write.invalid-message", {
    event: "audit-log-write.invalid-message",
    phase: "consumer",
    reason: "invalid_envelope",
    source: "audit",
  });
}

export async function handleAuditLogWriteBatch(batch: AuditLogWriteQueueBatch) {
  const start = monotonicNowMs();
  const now = Date.now();
  const valid: Array<{
    message: QueueMessage;
    parsed: AuditLogWriteQueueMessage;
  }> = [];
  let invalid = 0;
  let maxAgeMs = 0;
  let maxAttempts = 0;

  for (const message of batch.messages) {
    if (message.timestamp instanceof Date) {
      maxAgeMs = Math.max(
        maxAgeMs,
        Math.max(0, now - message.timestamp.getTime()),
      );
    }
    if (
      typeof message.attempts === "number" &&
      Number.isFinite(message.attempts)
    ) {
      maxAttempts = Math.max(maxAttempts, Math.max(0, message.attempts));
    }

    const parsed = parseAuditLogWriteQueueMessage(message.body);
    if (!parsed) {
      invalid += 1;
      logInvalidAuditMessage();
      // Invalid messages are permanent failures, but retrying is required so
      // Cloudflare Queues can move them to the configured DLQ for inspection.
      // Never include the body in the log: it may contain credentials or PII.
      message.retry();
      continue;
    }
    valid.push({ message, parsed });
  }

  let acked = 0;
  let retried = invalid;
  if (valid.length > 0) {
    try {
      await writeAuditLogs(
        valid.map(({ parsed }) => ({
          ...parsed.params,
          id: parsed.auditId,
        })),
      );
      for (const { message } of valid) {
        message.ack();
        acked += 1;
      }
    } catch (error) {
      retried += valid.length;
      logAppEvent(
        "error",
        "audit-log-write.retry",
        {
          event: "audit-log-write.retry",
          invalidMessageCount: invalid,
          messageType: "audit-log.write.v1",
          phase: "consumer",
          reason: "database_write_failed",
          source: "audit",
          validMessageCount: valid.length,
        },
        error,
      );
      for (const { message } of valid) message.retry();
    }
  }

  const report = {
    acked,
    invalid,
    maxAgeMs,
    maxAttempts,
    processed: batch.messages.length,
    retried,
  } satisfies AuditLogWriteQueueBatchReport;
  writeQueueBatchAnalytics({
    acked: report.acked,
    batchSize: batch.messages.length,
    durationMs: elapsedMs(start),
    invalid: report.invalid,
    maxAgeMs: report.maxAgeMs,
    maxAttempts: report.maxAttempts,
    messageType: "audit-log.write.v1",
    // A mixed batch is partial only when at least one record was committed
    // and another was sent to retry/DLQ. Any batch with no successful ack is a
    // retry, including an all-invalid batch or a failed atomic DB write.
    outcome:
      report.acked > 0 && report.retried > 0
        ? "partial"
        : report.retried > 0
          ? "retry"
          : "success",
    processed: report.processed,
    queue: "audit",
    retried: report.retried,
  });
  return report;
}
