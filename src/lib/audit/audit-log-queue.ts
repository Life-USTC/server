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

function parseAuditParams(value: unknown): Omit<AuditLogParams, "id"> | null {
  if (!isRecord(value)) return null;
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
    (value.metadata !== undefined && !isRecord(value.metadata))
  ) {
    return null;
  }

  return value as Omit<AuditLogParams, "id">;
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
  if (
    message.type !== "audit-log.write.v1" ||
    typeof message.auditId !== "string" ||
    message.auditId.length < 1 ||
    message.auditId.length > 128 ||
    !parseAuditParams(message.params)
  ) {
    return null;
  }
  return {
    auditId: message.auditId,
    params: parseAuditParams(message.params) as Omit<AuditLogParams, "id">,
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
    outcome:
      report.retried > 0 ? "retry" : report.invalid > 0 ? "partial" : "success",
    processed: report.processed,
    queue: "audit",
    retried: report.retried,
  });
  return report;
}
