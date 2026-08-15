import type { AuditLogParams } from "@/lib/audit/write-audit-log";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { logAppEvent } from "@/lib/log/app-logger";

export const AUDIT_LOG_WRITE_QUEUE_NAME = "life-ustc-audit-log-write";

export type AuditLogWriteQueueMessage = {
  params: AuditLogParams;
  type: "audit-log.write.v1";
};

type QueueMessage = {
  ack(): void;
  body: unknown;
  retry(): void;
};

export type AuditLogWriteQueueBatch = {
  messages: readonly QueueMessage[];
};

export function parseAuditLogWriteQueueMessage(
  value: unknown,
): AuditLogWriteQueueMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as { params?: unknown; type?: unknown };
  if (
    message.type !== "audit-log.write.v1" ||
    !message.params ||
    typeof message.params !== "object" ||
    typeof (message.params as { action?: unknown }).action !== "string"
  ) {
    return null;
  }
  return message as AuditLogWriteQueueMessage;
}

export async function handleAuditLogWriteBatch(batch: AuditLogWriteQueueBatch) {
  for (const message of batch.messages) {
    const parsed = parseAuditLogWriteQueueMessage(message.body);
    if (!parsed) {
      message.ack();
      continue;
    }
    try {
      await writeAuditLog(parsed.params);
      message.ack();
    } catch (error) {
      logAppEvent(
        "error",
        "audit-log-write.retry",
        {
          action: parsed.params.action,
          event: "audit-log-write.retry",
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
