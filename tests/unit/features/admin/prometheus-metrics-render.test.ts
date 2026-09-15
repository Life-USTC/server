import { describe, expect, it } from "vitest";
import type { PrometheusMetricsSnapshot } from "@/features/admin/server/prometheus-metrics-data";
import { renderPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-render";

function snapshot(): PrometheusMetricsSnapshot {
  return {
    generatedAt: "2026-09-14T16:02:00.000Z",
    firstFeatureRecordedAt: "2026-09-01T00:00:00.000Z",
    summary: {
      users: 3,
      comments: 4,
      homeworks: 5,
      oauthClients: 2,
      activeSuspensions: 1,
    },
    users: [{ window: "today", registeredUsers: 1, activeUsers: 2 }],
    features: [
      {
        window: "5m",
        feature: "catalog.search",
        operation: "search",
        protocol: "rest",
        surface: "unknown",
        authMode: "anonymous",
        outcome: "success",
        errorClass: "none",
        events: 3,
        users: 0,
        durationSeconds: 0.15,
        maxDurationSeconds: 0.1,
      },
    ],
    audit: [
      {
        window: "today",
        action: "homework_create",
        channel: "web",
        outcome: "success",
        events: 1,
      },
    ],
    oauth: [
      {
        window: "today",
        channel: "mcp",
        feature: "catalog",
        readCount: 7,
        writeCount: 3,
        errorCount: 2,
      },
    ],
    oauthSummary: [{ window: "today", activeClients: 1 }],
    runtime: [
      {
        window: "5m",
        level: "error",
        event: "api.request.error",
        status: "500",
        events: 2,
      },
    ],
  };
}

describe("Admin Prometheus metric definitions", () => {
  it("preserves source counts, intersection labels and seconds without treating windows as counters", () => {
    const body = renderPrometheusMetrics(snapshot());
    expect(body).toContain("# TYPE life_ustc_feature_operations gauge\n");
    expect(body).toContain(
      'life_ustc_feature_operations{auth_mode="anonymous",error_class="none",feature="catalog.search",operation="search",outcome="success",protocol="rest",surface="unknown",window="5m"} 3\n',
    );
    expect(body).toMatch(
      /^life_ustc_feature_operation_duration_seconds\{.*\} 0\.15$/m,
    );
    expect(body).toContain(
      'life_ustc_oauth_read_operations{channel="mcp",feature="catalog",window="today"} 7\n',
    );
    expect(body).toContain(
      'life_ustc_oauth_write_operations{channel="mcp",feature="catalog",window="today"} 3\n',
    );
    expect(body).toContain(
      'life_ustc_oauth_operation_errors{channel="mcp",feature="catalog",window="today"} 2\n',
    );
    expect(body).toContain('life_ustc_active_users{window="today"} 2\n');
    expect(body).not.toMatch(/# TYPE \S+ counter/);
    expect(body).not.toMatch(/(?:user_id|request_id|client_id|day)=/);
  });

  it("omits an undefined maximum for empty windows but preserves observed zero durations", () => {
    const value = snapshot();
    value.features[0].events = 0;
    value.features[0].durationSeconds = 0;
    value.features[0].maxDurationSeconds = 0;
    const empty = renderPrometheusMetrics(value);
    expect(empty).toMatch(/^life_ustc_feature_operations\{.*\} 0$/m);
    expect(empty).not.toMatch(
      /^life_ustc_feature_operation_max_duration_seconds\{/m,
    );

    value.features[0].events = 1;
    const observed = renderPrometheusMetrics(value);
    expect(observed).toMatch(
      /^life_ustc_feature_operation_max_duration_seconds\{.*\} 0$/m,
    );
  });

  it("uses Shanghai midnight across UTC date boundaries", () => {
    const body = renderPrometheusMetrics(snapshot());
    expect(body).toContain(
      `life_ustc_metrics_window_start_timestamp_seconds{window="today"} ${Date.parse("2026-09-14T16:00:00Z") / 1000}\n`,
    );
    expect(body).toContain(
      `life_ustc_metrics_window_start_timestamp_seconds{window="7d"} ${Date.parse("2026-09-08T16:00:00Z") / 1000}\n`,
    );
    expect(body).toContain(
      `life_ustc_metrics_window_start_timestamp_seconds{window="30d"} ${Date.parse("2026-08-16T16:00:00Z") / 1000}\n`,
    );
  });

  it("emits zero scalars for an empty system without inventing feature observations", () => {
    const value = snapshot();
    value.summary.users = 0;
    value.features = [];
    value.firstFeatureRecordedAt = null;
    value.users = [{ window: "today", registeredUsers: 0, activeUsers: null }];
    const body = renderPrometheusMetrics(value);
    expect(body).toContain("life_ustc_users 0\n");
    expect(body).toContain("life_ustc_feature_observation_available 0\n");
    expect(body).not.toMatch(/^life_ustc_active_users\{/m);
    expect(body).not.toMatch(/^life_ustc_feature_operations\{/m);
  });
});
