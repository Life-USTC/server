import { describe, expect, it } from "vitest";
import { renderPrometheusGauges } from "@/lib/metrics/prometheus-text";

describe("Prometheus text exposition", () => {
  it("escapes labels and help, sorts labels, and retains fractional seconds and zero", () => {
    expect(
      renderPrometheusGauges([
        {
          name: "test_seconds",
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
        renderPrometheusGauges([
          { name: "test", help: "test", samples: [{ value }] },
        ]),
      ).toThrow();
    },
  );

  it("rejects duplicate series even when label insertion order differs", () => {
    expect(() =>
      renderPrometheusGauges([
        {
          name: "test",
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
    const gauge = { name: "test", help: "test", samples: [] };
    expect(() => renderPrometheusGauges([gauge, gauge])).toThrow();
    expect(() =>
      renderPrometheusGauges([{ ...gauge, name: "bad name" }]),
    ).toThrow();
    expect(() =>
      renderPrometheusGauges([
        { ...gauge, samples: [{ labels: { "bad label": "x" }, value: 1 }] },
      ]),
    ).toThrow();
  });
});
