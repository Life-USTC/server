import {
  logMcpTransportResponse,
  type McpRequestSummary,
} from "./mcp-request-logging";
import { recordMcpResponseMetric } from "./mcp-route-metrics";

export function recordAndLogMcpResponse(input: {
  context: {
    correlationId: string;
    request: Request;
    requestUrl: URL;
  };
  phase: "auth-rejected" | "handled" | "origin-rejected";
  request: Request;
  rpcSummary: McpRequestSummary | null;
  start: number;
  status: number;
  toolCount?: number;
  wwwAuthenticatePrefix?: string | null;
}) {
  const durationMs = recordMcpResponseMetric({
    request: input.request,
    phase: input.phase,
    status: input.status,
    start: input.start,
  });
  logMcpTransportResponse({
    context: input.context,
    durationMs,
    phase: input.phase,
    rpcSummary: input.rpcSummary,
    status: input.status,
    toolCount: input.toolCount,
    wwwAuthenticatePrefix: input.wwwAuthenticatePrefix,
  });
  return durationMs;
}
