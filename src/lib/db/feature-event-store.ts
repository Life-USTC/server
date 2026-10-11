import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";

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

// Both inserts (including their metrics triggers) succeed or roll back together.
// No RETURNING: anonymous app-role writers do not have RLS read access.
const insertBatchSql = `
  WITH feature_insert AS (
    INSERT INTO "FeatureOperationEvent" (
      "id", "occurredAt", "feature", "operation", "protocol", "surface",
      "authMode", "outcome", "errorClass", "durationMs", "requestId", "userId"
    ) SELECT
      "id", COALESCE("occurredAt", CURRENT_TIMESTAMP), "feature", "operation",
      "protocol", "surface", "authMode", "outcome", "errorClass", "durationMs",
      "requestId", "userId"
    FROM jsonb_to_recordset($1::jsonb) AS event(
      "id" text, "occurredAt" timestamp(3), "feature" text, "operation" text,
      "protocol" text, "surface" text, "authMode" text, "outcome" text,
      "errorClass" text, "durationMs" double precision, "requestId" text, "userId" text
    )
    ON CONFLICT DO NOTHING
  )
  INSERT INTO "RuntimeIssueEvent" (
    "id", "occurredAt", "level", "event", "requestId", "route", "status"
  ) SELECT
    "id", COALESCE("occurredAt", CURRENT_TIMESTAMP), "level", "event", "requestId", "route", "status"
  FROM jsonb_to_recordset($2::jsonb) AS issue(
    "id" text, "occurredAt" timestamp(3), "level" text, "event" text,
    "requestId" text, "route" text, "status" integer
  )
  ON CONFLICT DO NOTHING
`;

function requiredString(value: string) {
  if (typeof value !== "string") {
    throw new TypeError("Observation text fields must be strings");
  }
  return value;
}

function optionalString(value: string | null | undefined) {
  return value == null ? null : requiredString(value);
}

function occurredAt(value: Date | undefined) {
  if (value == null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError("Observation occurredAt must be a valid Date");
  }
  return value.toISOString();
}

function featureRecord(event: FeatureEventInput) {
  // JSON would turn non-finite numbers into null. Reject them before binding,
  // and leave the database's dimension/range constraints authoritative.
  if (!Number.isFinite(event.durationMs)) {
    throw new TypeError("Observation durationMs must be finite");
  }
  return {
    id: requiredString(event.id),
    occurredAt: occurredAt(event.occurredAt),
    feature: requiredString(event.feature),
    operation: requiredString(event.operation),
    protocol: requiredString(event.protocol),
    surface: requiredString(event.surface),
    authMode: requiredString(event.authMode),
    outcome: requiredString(event.outcome),
    errorClass: requiredString(event.errorClass),
    durationMs: event.durationMs,
    requestId: optionalString(event.requestId),
    userId: optionalString(event.userId),
  };
}

function issueRecord(issue: RuntimeIssueInput) {
  if (issue.status != null && !Number.isInteger(issue.status)) {
    throw new TypeError("Observation status must be an integer");
  }
  return {
    id: requiredString(issue.id),
    occurredAt: occurredAt(issue.occurredAt),
    level: requiredString(issue.level),
    event: requiredString(issue.event),
    requestId: optionalString(issue.requestId),
    route: optionalString(issue.route),
    status: issue.status ?? null,
  };
}

/**
 * Persist bounded, content-free observations without inheriting a request's
 * ambient RLS transaction or its Cloudflare cleanup lifetime. The caller owns
 * scheduling, retries, and failure reporting; this function owns one atomic
 * statement and its short-lived database adapter.
 */
export async function writeObservabilityBatch({
  features = [],
  issues = [],
}: ObservabilityBatch): Promise<void> {
  assertBatchSize(features, issues);
  if (features.length === 0 && issues.length === 0) return;
  const featureJson = JSON.stringify(features.map(featureRecord));
  const issueJson = JSON.stringify(issues.map(issueRecord));
  await withRuntimeDatabaseAdapter("app", async (adapter) => {
    await adapter.executeRaw({
      sql: insertBatchSql,
      args: [featureJson, issueJson],
      argTypes: [
        { scalarType: "json", arity: "scalar" },
        { scalarType: "json", arity: "scalar" },
      ],
    });
  });
}
