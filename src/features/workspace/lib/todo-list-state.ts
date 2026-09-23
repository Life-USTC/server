type TodoFilter = "incomplete" | "completed" | "all";

type TodoFilterState = {
  completed: boolean;
};

export function filterTodos<Todo extends TodoFilterState>(
  todos: Todo[],
  filter: TodoFilter,
) {
  return todos.filter((todo) => {
    if (filter === "all") return true;
    return filter === "completed" ? todo.completed : !todo.completed;
  });
}

export function replaceTodoById<Todo extends { id: string | number }>(
  todos: Todo[],
  nextTodo: Todo,
) {
  return todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo));
}

export function sortTodosByDueDistance<
  Todo extends { dueAt?: Date | string | null },
>(todos: Todo[], referenceDate: Date): Todo[] {
  const referenceTime = referenceDate.getTime();
  return [...todos].sort((a, b) => {
    if (!a.dueAt) return b.dueAt ? -1 : 0;
    if (!b.dueAt) return 1;
    const aTime = new Date(a.dueAt).getTime();
    const bTime = new Date(b.dueAt).getTime();
    return (
      Math.abs(aTime - referenceTime) - Math.abs(bTime - referenceTime) ||
      aTime - bTime
    );
  });
}
