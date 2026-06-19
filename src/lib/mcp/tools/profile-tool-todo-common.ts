import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export type McpMode = "summary" | "default" | "full";
export type ToolExtra = { authInfo?: AuthInfo };
export type TodoPriority = "low" | "medium" | "high";
