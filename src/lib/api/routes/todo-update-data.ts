import type { Prisma, TodoPriority } from "@/generated/prisma/client";

export function buildTodoUpdateData(
  parsedBody: {
    completed?: boolean;
    content?: string | null;
    priority?: string;
    title?: string;
  },
  dueAt: Date | null | undefined,
  hasDueAt: boolean,
) {
  const updates: Prisma.TodoUpdateInput = {};
  if (parsedBody.title !== undefined) updates.title = parsedBody.title;
  if (Object.hasOwn(parsedBody, "content")) {
    updates.content = parsedBody.content?.trim() || null;
  }
  if (parsedBody.priority !== undefined) {
    updates.priority = parsedBody.priority as TodoPriority;
  }
  if (hasDueAt) updates.dueAt = dueAt;
  if (parsedBody.completed !== undefined)
    updates.completed = parsedBody.completed;
  return updates;
}
