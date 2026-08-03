import { listTodoSummary } from "@/features/todos/server/todo-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";
import type {
  McpMode,
  ToolExtra,
} from "@/lib/mcp/tools/workspace/profile-tool-todo-common";

export async function listMyTodosAction(
  {
    includeCompleted,
    limit,
    mode,
  }: { includeCompleted: boolean; limit: number; mode?: McpMode },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  return jsonToolResult(
    await listTodoSummary({
      filters: includeCompleted ? undefined : { completed: false },
      userId,
      take: limit,
    }),
    {
      mode: resolveMcpMode(mode),
    },
  );
}
