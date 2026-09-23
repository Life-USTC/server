import { describe, expect, it } from "vitest";
import { renderPrometheusMetricsText } from "@/lib/metrics/prometheus-text";

describe("Prometheus text exposition", () => {
  it("escapes labels and help, sorts labels, and retains fractional seconds and zero", () => {
    expect(
      renderPrometheusMetricsText([
        {
          name: "test_seconds",
          type: "gauge",
          help: "Line\nwith\\slash",
          samples: [
            { labels: { z: 'quote"\nslash\\', a: "first" }, value: 0.125 },
            { labels: { a: "zero", z: "" }, value: 0 },
          ],
        },
      ]),
    ).toBe(
      '# HELP test_seconds Line\\nwith\\\\slash\n# TYPE test_seconds gauge\ntest_seconds{a="first",z="quote\\"\\nslash\\\\"} 0.125\ntest_seconds{a="zero",z=""} 0\n',
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects unavailable numeric values %s instead of a misleading sample",
    (value) => {
      expect(() =>
        renderPrometheusMetricsText([
          {
            type: "gauge" as const,
            name: "test",
            help: "test",
            samples: [{ value }],
          },
        ]),
      ).toThrow();
    },
  );

  it("rejects duplicate series even when label insertion order differs", () => {
    expect(() =>
      renderPrometheusMetricsText([
        {
          name: "test",
          type: "gauge",
          help: "test",
          samples: [
            { labels: { a: "1", b: "2" }, value: 1 },
            { labels: { b: "2", a: "1" }, value: 2 },
          ],
        },
      ]),
    ).toThrow("Duplicate metric series");
  });

  it("rejects duplicate metric names and invalid names", () => {
    const gauge = {
      type: "gauge" as const,
      name: "test",
      help: "test",
      samples: [],
    };
    expect(() => renderPrometheusMetricsText([gauge, gauge])).toThrow();
    expect(() =>
      renderPrometheusMetricsText([{ ...gauge, name: "bad name" }]),
    ).toThrow();
    expect(() =>
      renderPrometheusMetricsText([
        { ...gauge, samples: [{ labels: { "bad label": "x" }, value: 1 }] },
      ]),
    ).toThrow();
  });
});

describe("Counter and histogram validation", () => {
  it("rejects negative counters and family name collisions", () => {
    expect(() =>
      renderPrometheusMetricsText([
        {
          type: "counter",
          name: "events_total",
          help: "events",
          samples: [{ value: -1 }],
        },
      ]),
    ).toThrow();
    expect(() =>
      renderPrometheusMetricsText([
        {
          type: "histogram",
          name: "duration_seconds",
          help: "duration",
          samples: [],
        },
        {
          type: "gauge",
          name: "duration_seconds_count",
          help: "collision",
          samples: [],
        },
      ]),
    ).toThrow();
  });
  it.each([
    [
      { upperBound: 0.1, count: 2 },
      { upperBound: 1, count: 1 },
    ],
    [
      { upperBound: 1, count: 1 },
      { upperBound: 0.1, count: 2 },
    ],
    [{ upperBound: 1, count: 4 }],
    [{ upperBound: Infinity, count: 3 }],
  ])("rejects malformed cumulative buckets", (...buckets) => {
    expect(() =>
      renderPrometheusMetricsText([
        {
          type: "histogram",
          name: "duration_seconds",
          help: "duration",
          samples: [{ count: 3, sum: 1, buckets }],
        },
      ]),
    ).toThrow();
  });
  it("emits zero histograms with an explicit infinite bucket and newline", () => {
    const text = renderPrometheusMetricsText([
      {
        type: "histogram",
        name: "duration_seconds",
        help: "duration",
        samples: [{ count: 0, sum: 0, buckets: [{ upperBound: 1, count: 0 }] }],
      },
    ]);
    expect(text).toContain('duration_seconds_bucket{le="+Inf"} 0\n');
    expect(text).toContain("duration_seconds_count 0\n");
  });
});
