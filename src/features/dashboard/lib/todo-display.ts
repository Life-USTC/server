type TodoState = {
  completed: boolean;
};

type TodoPriority = "high" | "medium" | "low" | string;

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
  if (priority === "high") return "border-error/40 bg-error/10 text-error";
  if (priority === "low") return "border-info/40 bg-info/10 text-info";
  return "border-base-300 bg-base-200 text-base-content";
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
