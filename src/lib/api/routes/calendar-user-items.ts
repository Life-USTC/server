export function userCalendarTodoItems(
  todos: Array<{
    content?: string | null;
    dueAt?: Date | null;
    id: string;
    priority: string;
    title: string;
  }>,
) {
  return todos.flatMap((todo) =>
    todo.dueAt
      ? [
          {
            id: todo.id,
            title: todo.title,
            content: todo.content ?? null,
            dueAt: todo.dueAt,
            priority: todo.priority as "high" | "low" | "medium",
          },
        ]
      : [],
  );
}

export function hasUserCalendarItems(input: {
  homeworks: unknown[];
  sections: unknown[];
  todos: unknown[];
}) {
  return (
    input.sections.length > 0 ||
    input.homeworks.length > 0 ||
    input.todos.length > 0
  );
}
