import {
  type PrometheusGauge,
  renderPrometheusGauges,
} from "@/lib/metrics/prometheus-text";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type { PrometheusMetricsSnapshot } from "./prometheus-metrics-data";

const CALENDAR_HELP =
  "Calendar windows include today in Asia/Shanghai; 7d and 30d include the preceding 6 and 29 days.";

/** Export source families separately: feature, audit and OAuth observations can overlap. */
export function renderPrometheusMetrics(snapshot: PrometheusMetricsSnapshot) {
  const gauges: PrometheusGauge[] = [];
  const add = (
    name: string,
    help: string,
    samples: PrometheusGauge["samples"],
  ) => {
    gauges.push({ name: `life_ustc_${name}`, help, samples });
  };
  const scalar = (name: string, help: string, value: number) =>
    add(name, help, [{ value }]);
  const generatedAt = new Date(snapshot.generatedAt);
  scalar(
    "metrics_generated_timestamp_seconds",
    "Unix time of the database snapshot; cache refresh interval is 60 seconds.",
    generatedAt.getTime() / 1000,
  );
  scalar(
    "feature_observation_available",
    "Whether any retained feature observation exists; absence is not evidence of zero activity.",
    snapshot.firstFeatureRecordedAt === null ? 0 : 1,
  );
  if (snapshot.firstFeatureRecordedAt !== null) {
    scalar(
      "feature_first_retained_timestamp_seconds",
      "Earliest retained feature observation; earlier periods have unknown coverage.",
      Date.parse(snapshot.firstFeatureRecordedAt) / 1000,
    );
  }
  const today = shanghaiDayjs(generatedAt).startOf("day");
  add("metrics_window_start_timestamp_seconds", CALENDAR_HELP, [
    { labels: { window: "5m" }, value: generatedAt.getTime() / 1000 - 300 },
    { labels: { window: "today" }, value: today.valueOf() / 1000 },
    {
      labels: { window: "7d" },
      value: today.subtract(6, "day").valueOf() / 1000,
    },
    {
      labels: { window: "30d" },
      value: today.subtract(29, "day").valueOf() / 1000,
    },
  ]);
  scalar(
    "users",
    "Currently retained user accounts, including admins; deleted accounts are absent.",
    snapshot.summary.users,
  );
  scalar(
    "comments",
    "Current comment rows, matching the admin overview.",
    snapshot.summary.comments,
  );
  scalar(
    "homeworks",
    "Current homework rows, matching the admin overview.",
    snapshot.summary.homeworks,
  );
  scalar(
    "oauth_clients",
    "Current registered OAuth clients.",
    snapshot.summary.oauthClients,
  );
  scalar(
    "unlifted_suspensions",
    "Suspension records whose liftedAt is null, including expired but unlifted records.",
    snapshot.summary.activeSuspensions,
  );
  add(
    "registered_users",
    `Currently retained accounts created in the window. ${CALENDAR_HELP}`,
    snapshot.users.map((row) => ({
      labels: { window: row.window },
      value: row.registeredUsers,
    })),
  );
  add(
    "active_users",
    `Distinct identified users with recorded feature operations, independent of outcome; anonymous visitors excluded. ${CALENDAR_HELP}`,
    snapshot.users.flatMap((row) =>
      row.activeUsers === null
        ? []
        : [{ labels: { window: row.window }, value: row.activeUsers }],
    ),
  );

  const featureLabels = (
    row: PrometheusMetricsSnapshot["features"][number],
  ) => ({
    window: row.window,
    feature: row.feature,
    operation: row.operation,
    protocol: row.protocol,
    surface: row.surface,
    auth_mode: row.authMode,
    outcome: row.outcome,
    error_class: row.errorClass,
  });
  add(
    "feature_operations",
    "Recorded feature operations in the window. Gauge, not a monotonic counter; do not apply rate or increase. Includes anonymous/public queries.",
    snapshot.features.map((row) => ({
      labels: featureLabels(row),
      value: row.events,
    })),
  );
  add(
    "feature_active_users",
    "Distinct identified users in each feature intersection and window. Do not sum across intersections to obtain distinct users.",
    snapshot.features.map((row) => ({
      labels: featureLabels(row),
      value: row.users,
    })),
  );
  add(
    "feature_operation_duration_seconds",
    "Total observed duration of feature operations in the window, in seconds. Divide by feature_operations for the mean; window gauge, not a counter.",
    snapshot.features.map((row) => ({
      labels: featureLabels(row),
      value: row.durationSeconds,
    })),
  );
  add(
    "feature_operation_max_duration_seconds",
    "Maximum observed feature operation duration in the window, in seconds.",
    snapshot.features.map((row) => ({
      labels: featureLabels(row),
      value: row.maxDurationSeconds,
    })),
  );
  add(
    "audit_events",
    `Recorded audit rows by action, channel and outcome. May overlap with feature and OAuth observations; do not add the families. ${CALENDAR_HELP}`,
    snapshot.audit.map((row) => ({
      labels: {
        window: row.window,
        action: row.action,
        channel: row.channel,
        outcome: row.outcome,
      },
      value: row.events,
    })),
  );
  for (const [operation, field] of [
    ["read", "readCount"],
    ["write", "writeCount"],
  ] as const) {
    add(
      `oauth_${operation}_operations`,
      `OAuth ${operation} calls from daily usage aggregates, including failed calls. ${CALENDAR_HELP}`,
      snapshot.oauth.map((row) => ({
        labels: {
          window: row.window,
          channel: row.channel,
          feature: row.feature,
        },
        value: row[field],
      })),
    );
  }
  add(
    "oauth_operation_errors",
    `Failed OAuth calls, a subset of read plus write calls, not additional operations. ${CALENDAR_HELP}`,
    snapshot.oauth.map((row) => ({
      labels: {
        window: row.window,
        channel: row.channel,
        feature: row.feature,
      },
      value: row.errorCount,
    })),
  );
  add(
    "oauth_active_clients",
    `Distinct OAuth clients with retained usage in the window. ${CALENDAR_HELP}`,
    snapshot.oauthSummary.map((row) => ({
      labels: { window: row.window },
      value: row.activeClients,
    })),
  );
  add(
    "runtime_issues",
    "Recorded runtime warnings/errors in the window. Safe event/status dimensions only; may overlap with feature failures.",
    snapshot.runtime.map((row) => ({
      labels: {
        window: row.window,
        level: row.level,
        event: row.event,
        status: row.status,
      },
      value: row.events,
    })),
  );
  return renderPrometheusGauges(gauges);
}
