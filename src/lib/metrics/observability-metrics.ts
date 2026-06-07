import {
  incrementCounter,
  observeDurationMs,
} from "@/lib/metrics/runtime-metrics";

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
  incrementCounter("life_ustc_mcp_http_requests_total", labels);
  observeDurationMs(
    "life_ustc_mcp_http_request_duration_ms",
    input.durationMs,
    {
      method: input.method,
      phase: input.phase,
    },
  );
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
  incrementCounter("life_ustc_mcp_tool_call_results_total", labels);
  observeDurationMs("life_ustc_mcp_tool_call_duration_ms", input.durationMs, {
    tool: input.toolName,
  });
}

export function recordOAuthTokenRequestMetric(input: {
  grantType?: string | null;
  hasResource: boolean;
  status: number;
  durationMs: number;
}) {
  const labels = {
    grant_type: input.grantType ?? "unknown",
    has_resource: input.hasResource,
    status: input.status,
  };
  incrementCounter("life_ustc_oauth_token_requests_total", labels);
  observeDurationMs(
    "life_ustc_oauth_token_request_duration_ms",
    input.durationMs,
    {
      grant_type: input.grantType ?? "unknown",
      has_resource: input.hasResource,
    },
  );
}

export function recordStorageOperationMetric(input: {
  operation: string;
  status: "success" | "error";
  durationMs: number;
}) {
  const labels = {
    operation: input.operation,
    status: input.status,
  };
  incrementCounter("life_ustc_storage_operations_total", labels);
  observeDurationMs(
    "life_ustc_storage_operation_duration_ms",
    input.durationMs,
    {
      operation: input.operation,
    },
  );
}

export function recordAuditWriteMetric(input: {
  action: string;
  status: "success" | "error";
  durationMs: number;
}) {
  const labels = {
    action: input.action,
    status: input.status,
  };
  incrementCounter("life_ustc_audit_writes_total", labels);
  observeDurationMs("life_ustc_audit_write_duration_ms", input.durationMs, {
    action: input.action,
  });
}
