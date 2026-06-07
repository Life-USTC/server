import { afterEach, describe, expect, it } from "vitest";
import {
  recordAuditWriteMetric,
  recordStorageOperationMetric,
} from "@/lib/metrics/observability-metrics";
import {
  incrementCounter,
  observeDurationMs,
  renderPrometheusMetrics,
  resetRuntimeMetricsForTest,
} from "@/lib/metrics/runtime-metrics";

describe("runtime metrics", () => {
  afterEach(() => {
    resetRuntimeMetricsForTest();
  });

  it("renders counters with stable Prometheus labels", () => {
    incrementCounter("life_ustc_mcp_tool_calls_total", {
      tool: "get_my_profile",
    });
    incrementCounter("life_ustc_mcp_tool_calls_total", {
      tool: "get_my_profile",
    });

    expect(renderPrometheusMetrics()).toContain(
      'life_ustc_mcp_tool_calls_total{tool="get_my_profile"} 2',
    );
  });

  it("renders duration count and sum", () => {
    observeDurationMs("life_ustc_mcp_http_request_duration_ms", 12, {
      method: "POST",
    });

    const metrics = renderPrometheusMetrics();

    expect(metrics).toContain(
      'life_ustc_mcp_http_request_duration_ms_count{method="POST"} 1',
    );
    expect(metrics).toContain(
      'life_ustc_mcp_http_request_duration_ms_sum{method="POST"} 12',
    );
  });

  it("bounds new metric series", () => {
    for (let i = 0; i < 505; i += 1) {
      incrementCounter("life_ustc_mcp_tool_calls_total", {
        tool: `tool_${i}`,
      });
    }

    const metrics = renderPrometheusMetrics();

    expect(metrics).toContain(
      'life_ustc_metrics_dropped_series_total{reason="series_limit"} 5',
    );
    expect(metrics).not.toContain('tool="tool_504"');
  });

  it("records storage operation status and duration", () => {
    recordStorageOperationMetric({
      operation: "PutObjectSignedUrl",
      status: "success",
      durationMs: 7,
    });

    const metrics = renderPrometheusMetrics();
    expect(metrics).toContain(
      'life_ustc_storage_operations_total{operation="PutObjectSignedUrl",status="success"} 1',
    );
    expect(metrics).toContain(
      'life_ustc_storage_operation_duration_ms_sum{operation="PutObjectSignedUrl"} 7',
    );
  });

  it("records audit write status and duration", () => {
    recordAuditWriteMetric({
      action: "comment_create",
      status: "success",
      durationMs: 3,
    });

    const metrics = renderPrometheusMetrics();
    expect(metrics).toContain(
      'life_ustc_audit_writes_total{action="comment_create",status="success"} 1',
    );
    expect(metrics).toContain(
      'life_ustc_audit_write_duration_ms_sum{action="comment_create"} 3',
    );
  });
});
