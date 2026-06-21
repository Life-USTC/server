import { listTodoSummary } from "@/features/todos/server/todo-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import type {
  McpMode,
  ToolExtra,
} from "@/lib/mcp/tools/profile-tool-todo-common";

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
      userId,
      where: {
        userId,
        ...(includeCompleted ? {} : { completed: false }),
      },
      take: limit,
    }),
    {
      mode: resolveMcpMode(mode),
    },
  );
}
