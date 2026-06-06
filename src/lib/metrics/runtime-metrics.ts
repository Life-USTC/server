type MetricLabels = Record<
  string,
  string | number | boolean | null | undefined
>;

type CounterKey = {
  name: string;
  labels: Record<string, string>;
};

const counters = new Map<string, number>();
const MAX_COUNTER_SERIES = 500;
const DROPPED_SERIES_METRIC = "life_ustc_metrics_dropped_series_total";

function normalizeLabelValue(value: MetricLabels[string]) {
  if (value == null) return "unknown";
  return String(value).replaceAll("\n", " ").slice(0, 120);
}

function buildCounterKey(name: string, labels: MetricLabels = {}): CounterKey {
  return {
    name,
    labels: Object.fromEntries(
      Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, normalizeLabelValue(value)]),
    ),
  };
}

function serializeCounterKey(key: CounterKey) {
  return JSON.stringify(key);
}

function parseCounterKey(value: string): CounterKey {
  return JSON.parse(value) as CounterKey;
}

export function incrementCounter(
  name: string,
  labels: MetricLabels = {},
  value = 1,
) {
  const key = serializeCounterKey(buildCounterKey(name, labels));
  if (!counters.has(key) && counters.size >= MAX_COUNTER_SERIES) {
    const droppedKey = serializeCounterKey(
      buildCounterKey(DROPPED_SERIES_METRIC, { reason: "series_limit" }),
    );
    counters.set(droppedKey, (counters.get(droppedKey) ?? 0) + value);
    return;
  }

  counters.set(key, (counters.get(key) ?? 0) + value);
}

export function observeDurationMs(
  name: string,
  durationMs: number,
  labels: MetricLabels = {},
) {
  incrementCounter(`${name}_count`, labels);
  incrementCounter(`${name}_sum`, labels, Math.max(0, durationMs));
}

function escapePrometheusLabelValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function formatLabels(labels: Record<string, string>) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries
    .map(([key, value]) => `${key}="${escapePrometheusLabelValue(value)}"`)
    .join(",")}}`;
}

export function renderPrometheusMetrics() {
  const lines = ["# Life USTC runtime metrics"];

  for (const [rawKey, value] of [...counters.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const key = parseCounterKey(rawKey);
    lines.push(`${key.name}${formatLabels(key.labels)} ${value}`);
  }

  return `${lines.join("\n")}\n`;
}

export function resetRuntimeMetricsForTest() {
  counters.clear();
}
