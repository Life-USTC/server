import { recordMcpHttpRequestMetric } from "@/lib/metrics/observability-metrics";

export function getRegisteredToolCount(server: unknown) {
  const tools = (server as unknown as { _registeredTools?: object })
    ._registeredTools;
  return tools ? Object.keys(tools).length : null;
}

export function getRegisteredToolNames(server: unknown) {
  const tools = (server as unknown as { _registeredTools?: object })
    ._registeredTools;
  return new Set(Object.keys(tools ?? {}));
}

export function recordMcpResponseMetric(input: {
  request: Request;
  phase: string;
  status: number;
  start: number;
}) {
  const durationMs = Date.now() - input.start;
  recordMcpHttpRequestMetric({
    method: input.request.method,
    phase: input.phase,
    status: input.status,
    durationMs,
  });
  return durationMs;
}
