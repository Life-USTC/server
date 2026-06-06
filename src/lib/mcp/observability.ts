import { recordMcpJsonRpcMetric } from "@/lib/metrics/observability-metrics";

type JsonRpcMessage = {
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

export type McpRequestSummary = {
  bodyKind:
    | "not-post"
    | "empty"
    | "body-too-large"
    | "jsonrpc-single"
    | "jsonrpc-batch"
    | "json-non-rpc"
    | "invalid-json";
  rpcCount: number;
  methods: string[];
  toolNames: string[];
  toolCalls: {
    toolName: string;
    argumentKeys: string[];
  }[];
  argumentKeys: string[];
  clientInfo?: {
    name?: string;
    version?: string;
  };
  protocolVersion?: string;
};

const MAX_RECORDED_ITEMS = 8;
const MAX_OBSERVABILITY_BODY_BYTES = 64 * 1024;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSafeString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 120) : undefined;
}

function summarizeJsonRpcMessage(message: JsonRpcMessage) {
  const method = asSafeString(message.method);
  const params = asRecord(message.params);
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
    const argumentsRecord = params ? asRecord(params.arguments) : null;
    summary.argumentKeys = argumentsRecord
      ? Object.keys(argumentsRecord).sort().slice(0, MAX_RECORDED_ITEMS)
      : [];
    summary.toolName = toolName ?? "unknown";
    summary.toolCall = {
      toolName: summary.toolName,
      argumentKeys: summary.argumentKeys,
    };
  }

  if (method === "initialize" && params) {
    summary.protocolVersion = asSafeString(params.protocolVersion);
    const clientInfo = asRecord(params.clientInfo);
    if (clientInfo) {
      summary.clientInfo = {
        name: asSafeString(clientInfo.name),
        version: asSafeString(clientInfo.version),
      };
    }
  }

  return summary;
}

export async function summarizeMcpJsonRpcRequest(
  request: Request,
): Promise<McpRequestSummary> {
  if (request.method !== "POST") {
    return {
      bodyKind: "not-post",
      rpcCount: 0,
      methods: [],
      toolNames: [],
      toolCalls: [],
      argumentKeys: [],
    };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_OBSERVABILITY_BODY_BYTES) {
    return {
      bodyKind: "body-too-large",
      rpcCount: 0,
      methods: [],
      toolNames: [],
      toolCalls: [],
      argumentKeys: [],
    };
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return {
      bodyKind: "invalid-json",
      rpcCount: 0,
      methods: [],
      toolNames: [],
      toolCalls: [],
      argumentKeys: [],
    };
  }

  const messages = Array.isArray(body) ? body : [body];
  if (messages.length === 0) {
    return {
      bodyKind: "empty",
      rpcCount: 0,
      methods: [],
      toolNames: [],
      toolCalls: [],
      argumentKeys: [],
    };
  }

  const rpcMessages = messages
    .map((message) => asRecord(message))
    .filter((message): message is JsonRpcMessage => Boolean(message?.method));

  if (rpcMessages.length === 0) {
    return {
      bodyKind: "json-non-rpc",
      rpcCount: 0,
      methods: [],
      toolNames: [],
      toolCalls: [],
      argumentKeys: [],
    };
  }

  const itemSummaries = rpcMessages.map(summarizeJsonRpcMessage);
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
