import { recordCounterAndDuration } from "./metric-recording";

export function recordStorageOperationMetric(input: {
  operation: string;
  status: "success" | "error";
  durationMs: number;
}) {
  const labels = {
    operation: input.operation,
    status: input.status,
  };
  recordCounterAndDuration({
    counter: "life_ustc_storage_operations_total",
    duration: "life_ustc_storage_operation_duration_ms",
    durationMs: input.durationMs,
    durationLabels: { operation: input.operation },
    labels,
  });
}
