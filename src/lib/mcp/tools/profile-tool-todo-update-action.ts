import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  parseOptionalFieldDate,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  buildTodoUpdateInput,
  todoSnapshotSelect,
} from "@/lib/mcp/tools/profile-tool-helpers";
import {
  findOwnedTodo,
  type McpMode,
  type TodoPriority,
  type ToolExtra,
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
  const todo = await findOwnedTodo(id);

  if (!todo) {
    return jsonToolResult({
      success: false,
      message: "Todo not found",
    });
  }

  if (todo.userId !== userId) {
    return jsonToolResult({
      success: false,
      message: "Forbidden",
    });
  }

  const hasDueAt = dueAt !== undefined;
  const parsedDueAt = parseOptionalFieldDate("dueAt", dueAt, hasDueAt);
  if (!parsedDueAt.ok) {
    return parsedDueAt.result;
  }

  const updates = buildTodoUpdateInput({
    completed,
    content,
    dueAt: parsedDueAt.value,
    hasDueAt,
    priority,
    title,
  });

  if (Object.keys(updates).length === 0) {
    return jsonToolResult({
      success: false,
      message: "No changes",
    });
  }

  await prisma.todo.update({
    where: { id },
    data: updates,
  });

  const updatedTodo = await prisma.todo.findUnique({
    where: { id },
    select: todoSnapshotSelect,
  });

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
