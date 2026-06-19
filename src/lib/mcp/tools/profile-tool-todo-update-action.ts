import {
  getTodoSnapshot,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import {
  getUserId,
  jsonToolResult,
  parseOptionalFieldDate,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import type {
  McpMode,
  TodoPriority,
  ToolExtra,
} from "@/lib/mcp/tools/profile-tool-todo-common";

export async function updateMyTodoAction(
  {
    id,
    title,
    content,
    priority,
    dueAt,
    completed,
    mode,
  }: {
    id: string;
    title?: string;
    content?: string | null;
    priority?: TodoPriority;
    dueAt?: string | null;
    completed?: boolean;
    mode?: McpMode;
  },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const hasDueAt = dueAt !== undefined;
  const parsedDueAt = parseOptionalFieldDate("dueAt", dueAt, hasDueAt);
  if (!parsedDueAt.ok) {
    return parsedDueAt.result;
  }

  const result = await updateOwnedTodo({
    id,
    userId,
    data: {
      completed,
      content,
      dueAt: parsedDueAt.value,
      hasDueAt,
      priority,
      title,
    },
  });

  if (!result.ok) {
    return jsonToolResult({
      success: false,
      message:
        result.error === "not_found"
          ? "Todo not found"
          : result.error === "forbidden"
            ? "Forbidden"
            : "No changes",
    });
  }

  const updatedTodo = await getTodoSnapshot(id);

  return jsonToolResult(
    {
      success: true,
      todo: updatedTodo,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
