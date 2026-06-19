import { deleteOwnedTodo } from "@/features/todos/server/todo-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import type {
  McpMode,
  ToolExtra,
} from "@/lib/mcp/tools/profile-tool-todo-common";

export async function deleteMyTodoAction(
  { id, mode }: { id: string; mode?: McpMode },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const result = await deleteOwnedTodo(id, userId);

  if (!result.ok) {
    return jsonToolResult({
      success: false,
      message: result.error === "not_found" ? "Todo not found" : "Forbidden",
    });
  }
  return jsonToolResult(
    {
      success: true,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
