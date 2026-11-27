export function replaceTodoById<Todo extends { id: string | number }>(
  todos: Todo[],
  nextTodo: Todo,
) {
  return todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo));
}

export function sortTodosByDeadline<
  Todo extends { dueAt?: Date | string | null },
>(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (!a.dueAt) return b.dueAt ? 1 : 0;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}
