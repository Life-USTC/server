type TodoState = {
  completed: boolean;
};

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
