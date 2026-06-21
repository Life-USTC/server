import type { TodoPriority } from "@/generated/prisma/client";

export const TODO_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
] as const satisfies readonly TodoPriority[];

export type TodoPriorityValue = (typeof TODO_PRIORITY_VALUES)[number];

export const DEFAULT_TODO_PRIORITY = "medium" satisfies TodoPriorityValue;
