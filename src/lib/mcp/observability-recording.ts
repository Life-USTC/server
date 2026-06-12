import type { McpRequestSummary } from "@/lib/mcp/observability-types";
import {
  recordMcpJsonRpcMetric,
  recordMcpToolCallMetric,
} from "@/lib/metrics/observability-metrics";

export function recordMcpJsonRpcSummaryMetrics(
  summary: McpRequestSummary,
  knownToolNames: Set<string>,
) {
  for (const method of summary.methods) {
    if (method !== "tools/call") {
      recordMcpJsonRpcMetric({ rpcMethod: method });
    }
  }

  for (const toolCall of summary.toolCalls) {
    const toolName = knownToolNames.has(toolCall.toolName)
      ? toolCall.toolName
      : "unknown";
    recordMcpJsonRpcMetric({
      rpcMethod: "tools/call",
      toolName,
    });
  }
}

export function recordMcpToolResultMetrics(
  summary: McpRequestSummary,
  knownToolNames: Set<string>,
  input: {
    durationMs: number;
    status: number;
  },
) {
  const status =
    input.status >= 200 && input.status < 400 ? "success" : "error";
  for (const toolCall of summary.toolCalls) {
    recordMcpToolCallMetric({
      toolName: knownToolNames.has(toolCall.toolName)
        ? toolCall.toolName
        : "unknown",
      status,
      durationMs: input.durationMs,
    });
  }
}
