import { prisma } from "@/lib/db/prisma";
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

export async function createMyTodoAction(
  {
    title,
    content,
    priority,
    dueAt,
    mode,
  }: {
    title: string;
    content?: string | null;
    priority: TodoPriority;
    dueAt?: string | null;
    mode?: McpMode;
  },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const parsedDueAt = parseOptionalFieldDate("dueAt", dueAt);
  if (!parsedDueAt.ok) {
    return parsedDueAt.result;
  }

  const todo = await prisma.todo.create({
    select: { id: true },
    data: {
      userId,
      title,
      content: content?.trim() || null,
      priority,
      dueAt: parsedDueAt.value,
    },
  });

  return jsonToolResult(
    {
      success: true,
      id: todo.id,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
