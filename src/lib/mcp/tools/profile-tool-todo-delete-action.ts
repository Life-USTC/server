import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  findOwnedTodo,
  type McpMode,
  type ToolExtra,
} from "@/lib/mcp/tools/profile-tool-todo-common";

export async function deleteMyTodoAction(
  { id, mode }: { id: string; mode?: McpMode },
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

  await prisma.todo.delete({ where: { id } });
  return jsonToolResult(
    {
      success: true,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
