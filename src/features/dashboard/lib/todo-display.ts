import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";

type TodoState = {
  completed: boolean;
};

type TodoPriority = TodoPriorityValue | string;

type TodoStatusLabels = {
  completed: string;
  pending: string;
};

type TodoActionLabels = {
  markIncomplete: string;
  markComplete: string;
};

export function todoStatus(todo: TodoState, labels: TodoStatusLabels) {
  return todo.completed ? labels.completed : labels.pending;
}

export function todoPriorityClass(priority: TodoPriority) {
  if (priority === "high") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (priority === "low") return "border-info/40 bg-info/10 text-info";
  return "border-border bg-muted text-foreground";
}

export function todoActionLabel(todo: TodoState, labels: TodoActionLabels) {
  return todo.completed ? labels.markIncomplete : labels.markComplete;
}

export function todoPriorityOptions<
  Priority extends string,
  Copy extends { priority: Record<Priority, string> },
>(priorityOrder: readonly Priority[], copy: Copy) {
  return priorityOrder.map((value) => ({
    value,
    label: copy.priority[value],
  }));
}
