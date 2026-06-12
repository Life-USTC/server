import type { McpRequestSummary } from "@/lib/mcp/observability-types";

export type JsonRpcMessage = {
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

export function asMcpObservabilityRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSafeString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 120) : undefined;
}

export function summarizeJsonRpcMessage(
  message: JsonRpcMessage,
  maxRecordedItems: number,
) {
  const method = asSafeString(message.method);
  const params = asMcpObservabilityRecord(message.params);
  const summary: {
    method?: string;
    toolName?: string;
    argumentKeys?: string[];
    toolCall?: {
      toolName: string;
      argumentKeys: string[];
    };
    clientInfo?: McpRequestSummary["clientInfo"];
    protocolVersion?: string;
  } = { method };

  if (method === "tools/call") {
    const toolName = params ? asSafeString(params.name) : undefined;
    const argumentsRecord = params
      ? asMcpObservabilityRecord(params.arguments)
      : null;
    summary.argumentKeys = argumentsRecord
      ? Object.keys(argumentsRecord).sort().slice(0, maxRecordedItems)
      : [];
    summary.toolName = toolName ?? "unknown";
    summary.toolCall = {
      toolName: summary.toolName,
      argumentKeys: summary.argumentKeys,
    };
  }

  if (method === "initialize" && params) {
    summary.protocolVersion = asSafeString(params.protocolVersion);
    const clientInfo = asMcpObservabilityRecord(params.clientInfo);
    if (clientInfo) {
      summary.clientInfo = {
        name: asSafeString(clientInfo.name),
        version: asSafeString(clientInfo.version),
      };
    }
  }

  return summary;
}
