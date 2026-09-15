export type PrometheusGauge = {
  name: string;
  help: string;
  samples: Array<{ labels?: Record<string, string>; value: number }>;
};

function escapeHelp(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
}

function escapeLabel(value: string) {
  return escapeHelp(value).replaceAll('"', '\\"');
}

/** Prometheus 0.0.4 gauge exposition, with no process-local registry or timestamps. */
export function renderPrometheusGauges(gauges: PrometheusGauge[]) {
  const lines: string[] = [];
  const names = new Set<string>();
  for (const gauge of gauges) {
    if (
      !/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(gauge.name) ||
      names.has(gauge.name)
    ) {
      throw new Error("Invalid or duplicate metric name");
    }
    names.add(gauge.name);
    lines.push(
      `# HELP ${gauge.name} ${escapeHelp(gauge.help)}`,
      `# TYPE ${gauge.name} gauge`,
    );
    const series = new Set<string>();
    for (const sample of gauge.samples) {
      if (!Number.isFinite(sample.value))
        throw new Error("Non-finite metric value");
      const labels = Object.entries(sample.labels ?? {}).sort(
        ([left], [right]) => left.localeCompare(right),
      );
      for (const [name] of labels) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
          throw new Error("Invalid label name");
      }
      const suffix = labels.length
        ? `{${labels.map(([name, value]) => `${name}="${escapeLabel(value)}"`).join(",")}}`
        : "";
      if (series.has(suffix)) throw new Error("Duplicate metric series");
      series.add(suffix);
      lines.push(`${gauge.name}${suffix} ${sample.value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
