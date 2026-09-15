import { describe, expect, it } from "vitest";
import type { PrometheusMetricsSnapshot } from "@/features/admin/server/prometheus-metrics-data";
import { renderPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-render";

function snapshot(): PrometheusMetricsSnapshot {
  return {
    generatedAt: "2026-09-15T00:00:15Z",
    activityGeneratedAt: "2026-09-15T00:00:00Z",
    counterStartedAt: "2026-09-01T00:00:00Z",
    firstFeatureRecordedAt: "2026-09-01T00:00:00Z",
    summary: {
      users: 3,
      comments: 4,
      homeworks: 5,
      oauthClients: 2,
      activeSuspensions: 0,
    },
    registrations: 7,
    deletions: 4,
    users: [{ window: "24h", activeUsers: 2 }],
    featureActivity: [
      { window: "24h", feature: "catalog.search", protocol: "rest", users: 2 },
    ],
    features: [
      {
        feature: "catalog.search",
        operation: "search",
        protocol: "rest",
        surface: "unknown",
        authMode: "anonymous",
        outcome: "success",
        events: 3,
      },
    ],
    featureErrors: [
      {
        feature: "catalog.search",
        protocol: "rest",
        errorClass: "internal",
        events: 1,
      },
    ],
    featureDurations: [
      {
        feature: "catalog.search",
        operation: "search",
        protocol: "rest",
        count: 3,
        durationSeconds: 11.015,
        buckets: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      },
    ],
    audit: [
      {
        action: "homework_create",
        channel: "web",
        outcome: "success",
        events: 1,
      },
    ],
    oauth: [
      {
        channel: "mcp",
        feature: "catalog.course",
        readCount: 7,
        writeCount: 3,
        errorCount: 2,
      },
    ],
    oauthSummary: [{ window: "24h", activeClients: 1 }],
    runtime: [{ level: "error", event: "other", status: "5xx", events: 2 }],
  };
}
describe("Native Prometheus metric definitions", () => {
  it("exports cumulative events and a valid cumulative histogram with seconds and bounded dimensions", () => {
    const text = renderPrometheusMetrics(snapshot());
    expect(text).toContain(
      "# TYPE life_ustc_feature_operations_total counter\n",
    );
    expect(text).toContain(
      'life_ustc_feature_operations_total{auth_mode="anonymous",feature="catalog.search",operation="search",outcome="success",protocol="rest",surface="unknown"} 3\n',
    );
    expect(text).toContain(
      "# TYPE life_ustc_feature_operation_duration_seconds histogram\n",
    );
    expect(text).toContain(
      'life_ustc_feature_operation_duration_seconds_bucket{feature="catalog.search",le="+Inf",operation="search",protocol="rest"} 3\n',
    );
    expect(text).toMatch(
      /^life_ustc_feature_operation_duration_seconds_sum\{.*\} 11\.015$/m,
    );
    expect(text).toMatch(
      /^life_ustc_feature_operation_duration_seconds_count\{.*\} 3$/m,
    );
    expect(text).toContain("life_ustc_user_registrations_total 7\n");
    expect(text).toContain('life_ustc_active_users{window="24h"} 2\n');
    expect(text).not.toMatch(/(?:user_id|client_id|request_id|day)=/);
    expect(text).not.toMatch(/^life_ustc_feature_operations\{/m);
    expect(text).not.toContain("max_duration");
    expect(
      text
        .split("\n")
        .filter((line) =>
          line.startsWith(
            "life_ustc_feature_operation_duration_seconds_bucket",
          ),
        ),
    ).toHaveLength(12);
  });
  it("distinguishes fresh counter time from cached activity time", () => {
    const value = snapshot();
    const text = renderPrometheusMetrics(value);
    expect(text).toContain(
      `life_ustc_metrics_generated_timestamp_seconds ${Date.parse(value.generatedAt) / 1000}\n`,
    );
    expect(text).toContain(
      `life_ustc_activity_generated_timestamp_seconds ${Date.parse(value.activityGeneratedAt) / 1000}\n`,
    );
  });
  it("does not invent activity when observations are unavailable", () => {
    const value = snapshot();
    value.firstFeatureRecordedAt = null;
    value.users = [{ window: "24h", activeUsers: null }];
    value.features = [];
    value.featureDurations = [];
    value.featureActivity = [];
    const text = renderPrometheusMetrics(value);
    expect(text).toContain("life_ustc_feature_observation_available 0\n");
    expect(text).not.toMatch(/^life_ustc_active_users\{/m);
    expect(text).not.toMatch(
      /^life_ustc_feature_operation_duration_seconds_bucket\{/m,
    );
  });
});
