import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import type { McpModeInput } from "@/lib/mcp/tools/_helpers";

export type McpMode = McpModeInput;
export type ToolExtra = { authInfo?: AuthInfo };
export type TodoPriority = TodoPriorityValue;
