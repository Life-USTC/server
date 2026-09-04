import { fail } from "@sveltejs/kit";
import { parseTodoPriorityInput } from "@/features/todos/lib/todo-priority";
import {
  getTodoContentValidationError,
  getTodoTitleValidationError,
  parseTodoDueAtInput,
} from "@/features/todos/lib/todo-schema";

type TodoActionCopy = {
  errorContentTooLong: string;
  errorInvalidDueAt: string;
  errorInvalidPriority: string;
  errorTitleRequired: string;
  errorTitleTooLong: string;
};

export async function readTodoForm(request: Request, copy: TodoActionCopy) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const titleError = getTodoTitleValidationError(title);
  if (titleError === "required") {
    return { error: fail(400, { error: copy.errorTitleRequired }) };
  }
  if (titleError === "too_long") {
    return { error: fail(400, { error: copy.errorTitleTooLong }) };
  }

  const content = String(form.get("content") ?? "").trim();
  if (getTodoContentValidationError(content)) {
    return { error: fail(400, { error: copy.errorContentTooLong }) };
  }

  const dueAt = parseTodoDueAtInput(form.get("dueAt"));
  if (dueAt === undefined) {
    return { error: fail(400, { error: copy.errorInvalidDueAt }) };
  }
  const priority = parseTodoPriorityInput(form.get("priority"));
  if (!priority.ok) {
    return { error: fail(400, { error: copy.errorInvalidPriority }) };
  }

  return {
    form,
    todo: {
      content: content || null,
      dueAt,
      priority: priority.value,
      title,
    },
  };
}
