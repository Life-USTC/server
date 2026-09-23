import * as z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const PROMETHEUS_METRICS_WINDOWS = ["24h", "7d", "30d"] as const;
const windowSchema = z.enum(PROMETHEUS_METRICS_WINDOWS);
const countSchema = z.number().nonnegative().safe();
const valueSchema = z.number().finite().nonnegative();
const label = z.string().min(1).max(96);
const timestamp = z.iso.datetime();
const featureLabels = z.object({
  feature: label,
  operation: label,
  protocol: label,
});
const payloadSchema = z.object({
  schema_version: z.literal(2),
  activity_generated_at: timestamp,
  counter_started_at: timestamp,
  first_feature_recorded_at: timestamp.nullable(),
  summary: z.object({
    users: countSchema,
    comments: countSchema,
    homeworks: countSchema,
    oauth_clients: countSchema,
    active_suspensions: countSchema,
  }),
  users: z.array(
    z.object({ window: windowSchema, active_users: countSchema.nullable() }),
  ),
  feature_activity: z.array(
    z.object({
      window: windowSchema,
      feature: label,
      protocol: label,
      users: countSchema,
    }),
  ),
  oauth_summary: z.array(
    z.object({ window: windowSchema, active_clients: countSchema }),
  ),
  counters: z.array(
    z.object({
      kind: z.enum([
        "features",
        "feature_errors",
        "audit",
        "runtime",
        "oauth_read",
        "oauth_write",
        "oauth_error",
        "registrations",
        "deletions",
        "duration_count",
        "duration_sum",
        "duration_bucket_00",
        "duration_bucket_01",
        "duration_bucket_02",
        "duration_bucket_03",
        "duration_bucket_04",
        "duration_bucket_05",
        "duration_bucket_06",
        "duration_bucket_07",
        "duration_bucket_08",
        "duration_bucket_09",
        "duration_bucket_10",
      ]),
      labels: z.record(z.string(), z.string()),
      value: valueSchema,
    }),
  ),
});

export type PrometheusMetricsSnapshot = ReturnType<
  typeof decodePrometheusMetricsSnapshot
>;

/** Fresh persistent counters and an independently cached exact activity snapshot. */
export async function readPrometheusMetrics(): Promise<PrometheusMetricsSnapshot> {
  const row = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      const [snapshot] = await tx.$queryRaw<
        Array<{ generatedAt: Date; payload: unknown }>
      >(
        Prisma.sql`SELECT "generatedAt", payload FROM public.read_prometheus_metrics_snapshot()`,
      );
      return snapshot;
    },
    { isolationLevel: "RepeatableRead", maxWait: 2_000, timeout: 15_000 },
  );
  if (!row || !(row.generatedAt instanceof Date))
    throw new Error("Prometheus metrics snapshot is unavailable");
  return decodePrometheusMetricsSnapshot(row.generatedAt, row.payload);
}

function decodePrometheusMetricsSnapshot(generatedAt: Date, payload: unknown) {
  const data = payloadSchema.parse(payload);
  const rows = <T extends z.ZodRawShape>(
    kind: string,
    schema: z.ZodObject<T>,
  ) =>
    data.counters
      .filter((row) => row.kind === kind)
      .map((row) => ({
        ...schema.parse(row.labels),
        value:
          kind === "duration_sum" ? row.value : countSchema.parse(row.value),
      }));
  const scalar = (kind: string) => {
    const matches = rows(kind, z.object({}).strict());
    if (matches.length !== 1)
      throw new Error(`Missing or duplicate ${kind} counter`);
    return matches[0].value;
  };
  const features = rows(
    "features",
    featureLabels.extend({ surface: label, auth_mode: label, outcome: label }),
  ).map((row) => ({
    feature: row.feature,
    operation: row.operation,
    protocol: row.protocol,
    surface: row.surface,
    authMode: row.auth_mode,
    outcome: row.outcome,
    events: row.value,
  }));
  const key = (row: { feature: string; operation: string; protocol: string }) =>
    JSON.stringify([row.feature, row.operation, row.protocol]);
  const sums = new Map(
    rows("duration_sum", featureLabels).map((row) => [key(row), row.value]),
  );
  const buckets = Array.from(
    { length: 11 },
    (_, index) =>
      new Map(
        rows(
          `duration_bucket_${String(index).padStart(2, "0")}`,
          featureLabels,
        ).map((row) => [key(row), row.value]),
      ),
  );
  const featureDurations = rows("duration_count", featureLabels).map((row) => {
    const durationSeconds = sums.get(key(row));
    const values = buckets.map((bucket) => bucket.get(key(row)));
    if (
      durationSeconds === undefined ||
      values.some((value) => value === undefined)
    )
      throw new Error("Incomplete histogram aggregate");
    return {
      feature: row.feature,
      operation: row.operation,
      protocol: row.protocol,
      count: row.value,
      durationSeconds,
      buckets: values as number[],
    };
  });
  const oauthLabels = z.object({ channel: label, feature: label });
  const oauth = new Map<
    string,
    {
      channel: string;
      feature: string;
      readCount: number;
      writeCount: number;
      errorCount: number;
    }
  >();
  for (const [kind, field] of [
    ["oauth_read", "readCount"],
    ["oauth_write", "writeCount"],
    ["oauth_error", "errorCount"],
  ] as const) {
    for (const row of rows(kind, oauthLabels)) {
      const id = JSON.stringify([row.channel, row.feature]);
      const entry = oauth.get(id) ?? {
        channel: row.channel,
        feature: row.feature,
        readCount: 0,
        writeCount: 0,
        errorCount: 0,
      };
      entry[field] = row.value;
      oauth.set(id, entry);
    }
  }
  return {
    generatedAt: generatedAt.toISOString(),
    activityGeneratedAt: data.activity_generated_at,
    counterStartedAt: data.counter_started_at,
    firstFeatureRecordedAt: data.first_feature_recorded_at,
    summary: {
      users: data.summary.users,
      comments: data.summary.comments,
      homeworks: data.summary.homeworks,
      oauthClients: data.summary.oauth_clients,
      activeSuspensions: data.summary.active_suspensions,
    },
    registrations: scalar("registrations"),
    deletions: scalar("deletions"),
    users: data.users.map((row) => ({
      window: row.window,
      activeUsers: row.active_users,
    })),
    featureActivity: data.feature_activity,
    features,
    featureErrors: rows(
      "feature_errors",
      z.object({ feature: label, protocol: label, error_class: label }),
    ).map((row) => ({
      feature: row.feature,
      protocol: row.protocol,
      errorClass: row.error_class,
      events: row.value,
    })),
    featureDurations,
    audit: rows(
      "audit",
      z.object({ action: label, channel: label, outcome: label }),
    ).map((row) => ({
      action: row.action,
      channel: row.channel,
      outcome: row.outcome,
      events: row.value,
    })),
    runtime: rows(
      "runtime",
      z.object({ level: label, event: label, status: label }),
    ).map((row) => ({
      level: row.level,
      event: row.event,
      status: row.status,
      events: row.value,
    })),
    oauth: [...oauth.values()],
    oauthSummary: data.oauth_summary.map((row) => ({
      window: row.window,
      activeClients: row.active_clients,
    })),
  };
}
