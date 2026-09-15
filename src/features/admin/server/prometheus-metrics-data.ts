import * as z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const PROMETHEUS_METRICS_WINDOWS = ["5m", "today", "7d", "30d"] as const;
export type PrometheusMetricsWindow =
  (typeof PROMETHEUS_METRICS_WINDOWS)[number];
export type PrometheusCalendarWindow = Exclude<PrometheusMetricsWindow, "5m">;

export type PrometheusMetricsSnapshot = {
  generatedAt: string;
  firstFeatureRecordedAt: string | null;
  summary: {
    users: number;
    comments: number;
    homeworks: number;
    oauthClients: number;
    activeSuspensions: number;
  };
  users: Array<{
    window: PrometheusCalendarWindow;
    registeredUsers: number;
    activeUsers: number | null;
  }>;
  features: Array<{
    window: PrometheusMetricsWindow;
    feature: string;
    operation: string;
    protocol: string;
    surface: string;
    authMode: string;
    outcome: string;
    errorClass: string;
    events: number;
    users: number;
    durationSeconds: number;
    maxDurationSeconds: number;
  }>;
  audit: Array<{
    window: PrometheusCalendarWindow;
    action: string;
    channel: string;
    outcome: string;
    events: number;
  }>;
  oauth: Array<{
    window: PrometheusCalendarWindow;
    channel: string;
    feature: string;
    readCount: number;
    writeCount: number;
    errorCount: number;
  }>;
  oauthSummary: Array<{
    window: PrometheusCalendarWindow;
    activeClients: number;
  }>;
  runtime: Array<{
    window: PrometheusMetricsWindow;
    level: string;
    event: string;
    status: string;
    events: number;
  }>;
};

type PrometheusMetricsSnapshotRow = {
  generatedAt: Date;
  payload: unknown;
};

const windowSchema = z.enum(["5m", "today", "7d", "30d"]);
const calendarWindowSchema = z.enum(["today", "7d", "30d"]);
const nonNegativeNumberSchema = z.number().finite().nonnegative();
const labelSchema = z.string().min(1).max(96);
const metricsPayloadSchema = z.object({
  schema_version: z.literal(1),
  first_feature_recorded_at: z.string().nullable(),
  summary: z.object({
    users: nonNegativeNumberSchema,
    comments: nonNegativeNumberSchema,
    homeworks: nonNegativeNumberSchema,
    oauth_clients: nonNegativeNumberSchema,
    active_suspensions: nonNegativeNumberSchema,
  }),
  users: z.array(
    z.object({
      window: calendarWindowSchema,
      registered_users: nonNegativeNumberSchema,
      active_users: nonNegativeNumberSchema.nullable(),
    }),
  ),
  features: z.array(
    z.object({
      window: windowSchema,
      feature: labelSchema,
      operation: labelSchema,
      protocol: labelSchema,
      surface: labelSchema,
      auth_mode: labelSchema,
      outcome: labelSchema,
      error_class: labelSchema,
      events: nonNegativeNumberSchema,
      users: nonNegativeNumberSchema,
      duration_seconds: nonNegativeNumberSchema,
      max_duration_seconds: nonNegativeNumberSchema,
    }),
  ),
  audit: z.array(
    z.object({
      window: calendarWindowSchema,
      action: labelSchema,
      channel: labelSchema,
      outcome: labelSchema,
      events: nonNegativeNumberSchema,
    }),
  ),
  oauth: z.array(
    z.object({
      window: calendarWindowSchema,
      channel: labelSchema,
      feature: labelSchema,
      read_count: nonNegativeNumberSchema,
      write_count: nonNegativeNumberSchema,
      error_count: nonNegativeNumberSchema,
    }),
  ),
  oauth_summary: z.array(
    z.object({
      window: calendarWindowSchema,
      active_clients: nonNegativeNumberSchema,
    }),
  ),
  runtime: z.array(
    z.object({
      window: windowSchema,
      level: labelSchema,
      event: labelSchema,
      status: labelSchema,
      events: nonNegativeNumberSchema,
    }),
  ),
});
export type PrometheusMetricsPayload = z.infer<typeof metricsPayloadSchema>;

/**
 * Read one sanitized, database-cached metrics snapshot. The database function
 * owns the source-table reads and cache refresh so this process never needs to
 * impersonate an admin RLS context or receive raw identifiers.
 */
export async function readPrometheusMetrics(): Promise<PrometheusMetricsSnapshot> {
  const row = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      const [snapshot] = await tx.$queryRaw<PrometheusMetricsSnapshotRow[]>(
        Prisma.sql`
          SELECT "generatedAt", payload
          FROM public.read_prometheus_metrics_snapshot()
        `,
      );
      return snapshot;
    },
    {
      isolationLevel: "RepeatableRead",
      maxWait: 2_000,
      timeout: 15_000,
    },
  );
  if (!row || !(row.generatedAt instanceof Date)) {
    throw new Error("Prometheus metrics snapshot is unavailable");
  }
  return decodePrometheusMetricsSnapshot(row.generatedAt, row.payload);
}

function decodePrometheusMetricsSnapshot(
  generatedAt: Date,
  payload: unknown,
): PrometheusMetricsSnapshot {
  // The SECURITY DEFINER function validates every source dimension and emits
  // the fixed JSON shape. Keep a narrow runtime check at this trust boundary
  // so a deployment with a mismatched migration fails the scrape explicitly.
  const parsed = metricsPayloadSchema.parse(payload);
  return {
    generatedAt: generatedAt.toISOString(),
    firstFeatureRecordedAt: parsed.first_feature_recorded_at,
    summary: {
      users: parsed.summary.users,
      comments: parsed.summary.comments,
      homeworks: parsed.summary.homeworks,
      oauthClients: parsed.summary.oauth_clients,
      activeSuspensions: parsed.summary.active_suspensions,
    },
    users: parsed.users.map((row) => ({
      window: row.window,
      registeredUsers: row.registered_users,
      activeUsers: row.active_users,
    })),
    features: parsed.features.map((row) => ({
      window: row.window,
      feature: row.feature,
      operation: row.operation,
      protocol: row.protocol,
      surface: row.surface,
      authMode: row.auth_mode,
      outcome: row.outcome,
      errorClass: row.error_class,
      events: row.events,
      users: row.users,
      durationSeconds: row.duration_seconds,
      maxDurationSeconds: row.max_duration_seconds,
    })),
    audit: parsed.audit.map((row) => ({
      window: row.window,
      action: row.action,
      channel: row.channel,
      outcome: row.outcome,
      events: row.events,
    })),
    oauth: parsed.oauth.map((row) => ({
      window: row.window,
      channel: row.channel,
      feature: row.feature,
      readCount: row.read_count,
      writeCount: row.write_count,
      errorCount: row.error_count,
    })),
    oauthSummary: parsed.oauth_summary.map((row) => ({
      window: row.window,
      activeClients: row.active_clients,
    })),
    runtime: parsed.runtime.map((row) => ({
      window: row.window,
      level: row.level,
      event: row.event,
      status: row.status,
      events: row.events,
    })),
  };
}
