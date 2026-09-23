type Labels = Record<string, string>;
type Sample = { labels?: Labels; value: number };
export type PrometheusMetric = {
  name: string;
  help: string;
} & (
  | { type: "gauge" | "counter"; samples: Sample[] }
  | {
      type: "histogram";
      samples: Array<{
        labels?: Labels;
        count: number;
        sum: number;
        buckets: Array<{ upperBound: number; count: number }>;
      }>;
    }
);

function escapeHelp(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
}

function labelSuffix(values: Labels = {}) {
  const labels = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));
  for (const [name] of labels) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || name.startsWith("__"))
      throw new Error("Invalid label name");
  }
  return labels.length
    ? `{${labels.map(([name, value]) => `${name}="${escapeHelp(value).replaceAll('"', '\\"')}"`).join(",")}}`
    : "";
}

/** Database-owned metrics: no process registry, implicit resets, or sample timestamps. */
export function renderPrometheusMetricsText(metrics: PrometheusMetric[]) {
  const lines: string[] = [];
  const names = new Set<string>();
  const series = new Set<string>();
  const append = (name: string, labels: Labels | undefined, value: number) => {
    if (!Number.isFinite(value)) throw new Error("Non-finite metric value");
    const key = name + labelSuffix(labels);
    if (series.has(key)) throw new Error("Duplicate metric series");
    series.add(key);
    lines.push(`${key} ${value}`);
  };
  for (const metric of metrics) {
    const familyNames =
      metric.type === "histogram"
        ? [
            metric.name,
            `${metric.name}_bucket`,
            `${metric.name}_sum`,
            `${metric.name}_count`,
          ]
        : [metric.name];
    for (const name of familyNames) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || names.has(name))
        throw new Error("Invalid or duplicate metric name");
      names.add(name);
    }
    lines.push(
      `# HELP ${metric.name} ${escapeHelp(metric.help)}`,
      `# TYPE ${metric.name} ${metric.type}`,
    );
    for (const sample of metric.samples) {
      if (metric.type !== "histogram") {
        const value = (sample as Sample).value;
        if (metric.type === "counter" && value < 0)
          throw new Error("Negative counter");
        append(metric.name, sample.labels, value);
        continue;
      }
      const histogram = sample as Extract<
        PrometheusMetric,
        { type: "histogram" }
      >["samples"][number];
      if ("le" in (histogram.labels ?? {}))
        throw new Error("Reserved histogram label");
      if (
        !Number.isSafeInteger(histogram.count) ||
        histogram.count < 0 ||
        !Number.isFinite(histogram.sum) ||
        histogram.sum < 0
      )
        throw new Error("Invalid histogram count or sum");
      let lastBound = -Infinity;
      let lastCount = 0;
      for (const bucket of histogram.buckets) {
        if (
          !Number.isFinite(bucket.upperBound) ||
          bucket.upperBound <= lastBound ||
          !Number.isSafeInteger(bucket.count) ||
          bucket.count < lastCount ||
          bucket.count > histogram.count
        )
          throw new Error("Invalid cumulative histogram buckets");
        append(
          `${metric.name}_bucket`,
          { ...histogram.labels, le: String(bucket.upperBound) },
          bucket.count,
        );
        lastBound = bucket.upperBound;
        lastCount = bucket.count;
      }
      append(
        `${metric.name}_bucket`,
        { ...histogram.labels, le: "+Inf" },
        histogram.count,
      );
      append(`${metric.name}_sum`, histogram.labels, histogram.sum);
      append(`${metric.name}_count`, histogram.labels, histogram.count);
    }
  }
  return `${lines.join("\n")}\n`;
}
