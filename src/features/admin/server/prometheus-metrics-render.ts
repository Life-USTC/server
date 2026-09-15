import {
  type PrometheusMetric,
  renderPrometheusMetricsText,
} from "@/lib/metrics/prometheus-text";
import type { PrometheusMetricsSnapshot } from "./prometheus-metrics-data";

// Matches the persistent observation buckets; changing boundaries requires a new histogram family.
export const FEATURE_DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

/** Each source is a separate family: feature, audit and OAuth records can overlap. */
export function renderPrometheusMetrics(snapshot: PrometheusMetricsSnapshot) {
  const metrics: PrometheusMetric[] = [];
  const add = (
    name: string,
    help: string,
    type: "counter" | "gauge",
    samples: Array<{ labels?: Record<string, string>; value: number }>,
  ) => {
    metrics.push({ name: `life_ustc_${name}`, help, type, samples });
  };
  const scalar = (
    name: string,
    help: string,
    value: number,
    type: "counter" | "gauge" = "gauge",
  ) => add(name, help, type, [{ value }]);
  scalar(
    "metrics_generated_timestamp_seconds",
    "Unix time of the fresh cumulative metrics snapshot.",
    Date.parse(snapshot.generatedAt) / 1000,
  );
  scalar(
    "activity_generated_timestamp_seconds",
    "Unix time of the cached activity and current-state gauges; refresh interval is 60 seconds.",
    Date.parse(snapshot.activityGeneratedAt) / 1000,
  );
  scalar(
    "counters_started_timestamp_seconds",
    "Unix time durable counting began; earlier events are not backfilled.",
    Date.parse(snapshot.counterStartedAt) / 1000,
  );
  scalar(
    "feature_observation_available",
    "Whether retained feature observations exist; missing history is not zero activity.",
    snapshot.firstFeatureRecordedAt === null ? 0 : 1,
  );
  if (snapshot.firstFeatureRecordedAt !== null)
    scalar(
      "feature_first_retained_timestamp_seconds",
      "Earliest retained feature observation; earlier activity coverage is unknown.",
      Date.parse(snapshot.firstFeatureRecordedAt) / 1000,
    );
  scalar(
    "users",
    "Currently retained user accounts, including admins.",
    snapshot.summary.users,
  );
  scalar(
    "comments",
    "Current comment rows, including soft-deleted records.",
    snapshot.summary.comments,
  );
  scalar("homeworks", "Current homework rows.", snapshot.summary.homeworks);
  scalar(
    "oauth_clients",
    "Current registered OAuth clients.",
    snapshot.summary.oauthClients,
  );
  scalar(
    "unlifted_suspensions",
    "Suspension records whose liftedAt is null, including expired records.",
    snapshot.summary.activeSuspensions,
  );
  scalar(
    "user_registrations_total",
    "User accounts created since durable counting began; deletion does not decrement this counter.",
    snapshot.registrations,
    "counter",
  );
  scalar(
    "user_deletions_total",
    "User accounts deleted since durable counting began.",
    snapshot.deletions,
    "counter",
  );
  add(
    "active_users",
    "Distinct identified users with recorded operations in the rolling window (24h, 7d, 30d); all outcomes, excluding anonymous users.",
    "gauge",
    snapshot.users.flatMap((row) =>
      row.activeUsers === null
        ? []
        : [{ labels: { window: row.window }, value: row.activeUsers }],
    ),
  );
  add(
    "feature_active_users",
    "Distinct identified users by feature and protocol in the rolling window; do not sum to obtain distinct totals.",
    "gauge",
    snapshot.featureActivity.map((row) => ({
      labels: {
        window: row.window,
        feature: row.feature,
        protocol: row.protocol,
      },
      value: row.users,
    })),
  );
  add(
    "feature_operations_total",
    "Durably recorded feature operations, including public queries; best-effort capture, not a lossless request ledger.",
    "counter",
    snapshot.features.map((row) => ({
      labels: {
        feature: row.feature,
        operation: row.operation,
        protocol: row.protocol,
        surface: row.surface,
        auth_mode: row.authMode,
        outcome: row.outcome,
      },
      value: row.events,
    })),
  );
  add(
    "feature_errors_total",
    "Recorded feature failures by error class; a subset of feature operations, not additional operations.",
    "counter",
    snapshot.featureErrors.map((row) => ({
      labels: {
        feature: row.feature,
        protocol: row.protocol,
        error_class: row.errorClass,
      },
      value: row.events,
    })),
  );
  metrics.push({
    name: "life_ustc_feature_operation_duration_seconds",
    help: "Cumulative recorded feature operation wall durations in seconds; all outcomes. Buckets are retained independently of raw events.",
    type: "histogram",
    samples: snapshot.featureDurations.map((row) => {
      if (row.buckets.length !== FEATURE_DURATION_BUCKETS_SECONDS.length)
        throw new Error("Unexpected duration bucket schema");
      return {
        labels: {
          feature: row.feature,
          operation: row.operation,
          protocol: row.protocol,
        },
        count: row.count,
        sum: row.durationSeconds,
        buckets: FEATURE_DURATION_BUCKETS_SECONDS.map((upperBound, index) => ({
          upperBound,
          count: row.buckets[index],
        })),
      };
    }),
  });
  add(
    "audit_events_total",
    "Audit rows excluding external OAuth mutation rows; may overlap feature observations, do not add families.",
    "counter",
    snapshot.audit.map((row) => ({
      labels: {
        action: row.action,
        channel: row.channel,
        outcome: row.outcome,
      },
      value: row.events,
    })),
  );
  for (const [name, field] of [
    ["read", "readCount"],
    ["write", "writeCount"],
    ["error", "errorCount"],
  ] as const) {
    add(
      `oauth_${name}_operations_total`,
      name === "error"
        ? "Failed OAuth calls, a subset of read plus write calls."
        : `Recorded OAuth ${name} calls, including failed calls.`,
      "counter",
      snapshot.oauth.map((row) => ({
        labels: { channel: row.channel, feature: row.feature },
        value: row[field],
      })),
    );
  }
  add(
    "oauth_active_clients",
    "Distinct OAuth clients with recorded usage in the rolling window.",
    "gauge",
    snapshot.oauthSummary.map((row) => ({
      labels: { window: row.window },
      value: row.activeClients,
    })),
  );
  add(
    "runtime_issues_total",
    "Recorded runtime warnings and errors by bounded category; may overlap feature failures.",
    "counter",
    snapshot.runtime.map((row) => ({
      labels: { level: row.level, event: row.event, status: row.status },
      value: row.events,
    })),
  );
  return renderPrometheusMetricsText(metrics);
}
