import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { todoSnapshotSelect } from "@/lib/mcp/tools/profile-tool-helpers";
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
  const [incompleteCount, completedCount, overdueCount, todos] =
    await Promise.all([
      prisma.todo.count({
        where: { userId, completed: false },
      }),
      prisma.todo.count({
        where: { userId, completed: true },
      }),
      prisma.todo.count({
        where: {
          userId,
          completed: false,
          dueAt: { lt: new Date() },
        },
      }),
      prisma.todo.findMany({
        where: {
          userId,
          ...(includeCompleted ? {} : { completed: false }),
        },
        select: todoSnapshotSelect,
        orderBy: [
          { completed: "asc" },
          { dueAt: "asc" },
          { createdAt: "desc" },
        ],
        take: limit,
      }),
    ]);
  return jsonToolResult(
    {
      counts: {
        incomplete: incompleteCount,
        completed: completedCount,
        overdue: overdueCount,
      },
      todos,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
