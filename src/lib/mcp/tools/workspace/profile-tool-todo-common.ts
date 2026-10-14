import type { AuthInfo } from "@modelcontextprotocol/server";
import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import type { McpModeInput } from "@/lib/mcp/tools/_shared/helpers";

export type McpMode = McpModeInput;
export type ToolExtra = { http?: { authInfo?: AuthInfo } };
export type TodoPriority = TodoPriorityValue;
