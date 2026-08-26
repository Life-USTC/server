import {
  AuditAction,
  AuditChannel,
  AuditOutcome,
} from "@/generated/prisma/client";
import type { AuditLogParams } from "@/lib/audit/write-audit-log";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { logAppEvent } from "@/lib/log/app-logger";

export const AUDIT_LOG_WRITE_QUEUE_NAME = "life-ustc-audit-log-write";

export type AuditLogWriteQueueMessage = {
  auditId: string;
  params: Omit<AuditLogParams, "id">;
  type: "audit-log.write.v1";
};

type QueueMessage = {
  ack(): void;
  body: unknown;
  retry(): void;
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
  for (const message of batch.messages) {
    const parsed = parseAuditLogWriteQueueMessage(message.body);
    if (!parsed) {
      logInvalidAuditMessage();
      // Invalid messages are permanent failures, but retrying is required so
      // Cloudflare Queues can move them to the configured DLQ for inspection.
      // Never include the body in the log: it may contain credentials or PII.
      message.retry();
      continue;
    }
    try {
      await writeAuditLog({ ...parsed.params, id: parsed.auditId });
      message.ack();
    } catch (error) {
      logAppEvent(
        "error",
        "audit-log-write.retry",
        {
          action: parsed.params.action,
          event: "audit-log-write.retry",
          phase: "consumer",
          reason: "database_write_failed",
          messageType: parsed.type,
          source: "audit",
          targetType: parsed.params.targetType,
        },
        error,
      );
      message.retry();
    }
  }
}
