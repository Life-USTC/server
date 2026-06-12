import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/db/prisma";

export type McpMode = "summary" | "default" | "full";
export type ToolExtra = { authInfo?: AuthInfo };
export type TodoPriority = "low" | "medium" | "high";

export async function findOwnedTodo(id: string) {
  return prisma.todo.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
}
