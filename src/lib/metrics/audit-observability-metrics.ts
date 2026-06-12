import { recordCounterAndDuration } from "./metric-recording";

export function recordAuditWriteMetric(input: {
  action: string;
  status: "success" | "error";
  durationMs: number;
}) {
  const labels = {
    action: input.action,
    status: input.status,
  };
  recordCounterAndDuration({
    counter: "life_ustc_audit_writes_total",
    duration: "life_ustc_audit_write_duration_ms",
    durationMs: input.durationMs,
    durationLabels: { action: input.action },
    labels,
  });
}
