import {
  incrementCounter,
  observeDurationMs,
} from "@/lib/metrics/runtime-metrics";

export function recordCounterAndDuration(input: {
  counter: string;
  duration: string;
  durationMs: number;
  durationLabels: Record<string, string | boolean | number>;
  labels: Record<string, string | boolean | number>;
}) {
  incrementCounter(input.counter, input.labels);
  observeDurationMs(input.duration, input.durationMs, input.durationLabels);
}
