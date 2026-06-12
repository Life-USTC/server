import {
  asMcpObservabilityRecord,
  type JsonRpcMessage,
  summarizeJsonRpcMessage,
} from "@/lib/mcp/observability-message-summary";
import type { McpRequestSummary } from "@/lib/mcp/observability-types";

const MAX_RECORDED_ITEMS = 8;
const MAX_OBSERVABILITY_BODY_BYTES = 64 * 1024;

function emptySummary(bodyKind: McpRequestSummary["bodyKind"]) {
  return {
    bodyKind,
    rpcCount: 0,
    methods: [],
    toolNames: [],
    toolCalls: [],
    argumentKeys: [],
  };
}

export async function summarizeMcpJsonRpcRequest(
  request: Request,
): Promise<McpRequestSummary> {
  if (request.method !== "POST") {
    return emptySummary("not-post");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_OBSERVABILITY_BODY_BYTES) {
    return emptySummary("body-too-large");
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return emptySummary("invalid-json");
  }

  const messages = Array.isArray(body) ? body : [body];
  if (messages.length === 0) {
    return emptySummary("empty");
  }

  const rpcMessages = messages
    .map((message) => asMcpObservabilityRecord(message))
    .filter((message): message is JsonRpcMessage => Boolean(message?.method));

  if (rpcMessages.length === 0) {
    return emptySummary("json-non-rpc");
  }

  const itemSummaries = rpcMessages.map((message) =>
    summarizeJsonRpcMessage(message, MAX_RECORDED_ITEMS),
  );
  return {
    bodyKind: Array.isArray(body) ? "jsonrpc-batch" : "jsonrpc-single",
    rpcCount: rpcMessages.length,
    methods: itemSummaries
      .map((item) => item.method)
      .filter((method): method is string => Boolean(method))
      .slice(0, MAX_RECORDED_ITEMS),
    toolNames: itemSummaries
      .map((item) => item.toolName)
      .filter((toolName): toolName is string => Boolean(toolName))
      .slice(0, MAX_RECORDED_ITEMS),
    toolCalls: itemSummaries
      .map((item) => item.toolCall)
      .filter((toolCall): toolCall is NonNullable<typeof toolCall> =>
        Boolean(toolCall),
      )
      .slice(0, MAX_RECORDED_ITEMS),
    argumentKeys: [
      ...new Set(itemSummaries.flatMap((item) => item.argumentKeys ?? [])),
    ].slice(0, MAX_RECORDED_ITEMS),
    clientInfo: itemSummaries.find((item) => item.clientInfo)?.clientInfo,
    protocolVersion: itemSummaries.find((item) => item.protocolVersion)
      ?.protocolVersion,
  };
}
