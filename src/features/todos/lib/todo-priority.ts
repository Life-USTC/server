import type { TodoPriority } from "@/generated/prisma/client";

export const TODO_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
] as const satisfies readonly TodoPriority[];

export type TodoPriorityValue = (typeof TODO_PRIORITY_VALUES)[number];

export const DEFAULT_TODO_PRIORITY = "medium" satisfies TodoPriorityValue;

export const TODO_PRIORITIES = new Set<TodoPriorityValue>(TODO_PRIORITY_VALUES);

export function isTodoPriorityValue(value: string): value is TodoPriorityValue {
  return TODO_PRIORITIES.has(value as TodoPriorityValue);
}

export function parseTodoPriorityInput(
  value: unknown,
): { ok: true; value: TodoPriorityValue } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: DEFAULT_TODO_PRIORITY };
  }

  const priority = String(value);
  return isTodoPriorityValue(priority)
    ? { ok: true, value: priority }
    : { ok: false };
}
