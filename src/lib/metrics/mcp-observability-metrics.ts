import { incrementCounter } from "@/lib/metrics/runtime-metrics";
import { recordCounterAndDuration } from "./metric-recording";

const KNOWN_RPC_METHODS = new Set([
  "initialize",
  "notifications/cancelled",
  "notifications/initialized",
  "ping",
  "resources/list",
  "resources/read",
  "tools/call",
  "tools/list",
]);

function normalizeRpcMethod(method: string) {
  return KNOWN_RPC_METHODS.has(method) ? method : "other";
}

export function recordMcpHttpRequestMetric(input: {
  method: string;
  phase: string;
  status: number;
  durationMs: number;
}) {
  const labels = {
    method: input.method,
    phase: input.phase,
    status: input.status,
  };
  recordCounterAndDuration({
    counter: "life_ustc_mcp_http_requests_total",
    duration: "life_ustc_mcp_http_request_duration_ms",
    durationMs: input.durationMs,
    durationLabels: {
      method: input.method,
      phase: input.phase,
    },
    labels,
  });
}

export function recordMcpJsonRpcMetric(input: {
  rpcMethod: string;
  toolName?: string | null;
}) {
  const rpcMethod = normalizeRpcMethod(input.rpcMethod);
  const toolName = input.toolName ?? "none";
  incrementCounter("life_ustc_mcp_jsonrpc_requests_total", {
    rpc_method: rpcMethod,
  });
  if (rpcMethod === "tools/call") {
    incrementCounter("life_ustc_mcp_tool_calls_total", {
      tool: toolName,
    });
  }
}

export function recordMcpToolCallMetric(input: {
  toolName: string;
  status: "success" | "error";
  durationMs: number;
}) {
  const labels = {
    status: input.status,
    tool: input.toolName,
  };
  recordCounterAndDuration({
    counter: "life_ustc_mcp_tool_call_results_total",
    duration: "life_ustc_mcp_tool_call_duration_ms",
    durationMs: input.durationMs,
    durationLabels: { tool: input.toolName },
    labels,
  });
}
