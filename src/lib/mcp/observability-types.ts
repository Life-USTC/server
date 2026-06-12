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
