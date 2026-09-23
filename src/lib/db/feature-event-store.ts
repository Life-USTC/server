import { createBasePrisma } from "@/lib/db/prisma-query-events";

export const FEATURE_EVENT_STORE_MAX_BATCH_SIZE = 256;

export type FeatureEventInput = {
  id: string;
  occurredAt?: Date;
  feature: string;
  operation: string;
  protocol: string;
  surface: string;
  authMode: string;
  outcome: string;
  errorClass: string;
  durationMs: number;
  requestId?: string | null;
  userId?: string | null;
};

export type RuntimeIssueInput = {
  id: string;
  occurredAt?: Date;
  level: "warn" | "error";
  event: string;
  requestId?: string | null;
  route?: string | null;
  status?: number | null;
};

export type ObservabilityBatch = {
  features?: readonly FeatureEventInput[];
  issues?: readonly RuntimeIssueInput[];
};

function assertBatchSize(
  features: readonly FeatureEventInput[],
  issues: readonly RuntimeIssueInput[],
) {
  const size = features.length + issues.length;
  if (size > FEATURE_EVENT_STORE_MAX_BATCH_SIZE) {
    throw new RangeError(
      `observability batch exceeds ${FEATURE_EVENT_STORE_MAX_BATCH_SIZE} rows`,
    );
  }
}

/**
 * Persist bounded, content-free observations without inheriting a request's
 * ambient RLS transaction or its Cloudflare cleanup lifetime. The caller owns
 * scheduling, retries, and failure reporting; this function only performs one
 * short-lived database transaction.
 */
export async function writeObservabilityBatch({
  features = [],
  issues = [],
}: ObservabilityBatch): Promise<void> {
  assertBatchSize(features, issues);
  if (features.length === 0 && issues.length === 0) return;

  const client = createBasePrisma();
  try {
    const writes = [];
    if (features.length > 0) {
      writes.push(
        client.featureOperationEvent.createMany({
          data: features.map((event) => ({
            id: event.id,
            ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
            feature: event.feature,
            operation: event.operation,
            protocol: event.protocol,
            surface: event.surface,
            authMode: event.authMode,
            outcome: event.outcome,
            errorClass: event.errorClass,
            durationMs: event.durationMs,
            ...(event.requestId === undefined
              ? {}
              : { requestId: event.requestId }),
            ...(event.userId === undefined ? {} : { userId: event.userId }),
          })),
          skipDuplicates: true,
        }),
      );
    }
    if (issues.length > 0) {
      writes.push(
        client.runtimeIssueEvent.createMany({
          data: issues.map((issue) => ({
            id: issue.id,
            ...(issue.occurredAt ? { occurredAt: issue.occurredAt } : {}),
            level: issue.level,
            event: issue.event,
            ...(issue.requestId === undefined
              ? {}
              : { requestId: issue.requestId }),
            ...(issue.route === undefined ? {} : { route: issue.route }),
            ...(issue.status === undefined ? {} : { status: issue.status }),
          })),
          skipDuplicates: true,
        }),
      );
    }
    await client.$transaction(writes);
  } finally {
    await client.$disconnect();
  }
}
