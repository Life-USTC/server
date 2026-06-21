import { fail } from "@sveltejs/kit";
import {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/todos/lib/todo-limits";
import { parseTodoPriorityInput } from "@/features/todos/lib/todo-priority";
import { parseOptionalLocalDateTime } from "./dashboard-form-dates";

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
  if (!title) return { error: fail(400, { error: copy.errorTitleRequired }) };
  if (title.length > TODO_TITLE_MAX_LENGTH) {
    return { error: fail(400, { error: copy.errorTitleTooLong }) };
  }

  const content = String(form.get("content") ?? "").trim();
  if (content.length > TODO_CONTENT_MAX_LENGTH) {
    return { error: fail(400, { error: copy.errorContentTooLong }) };
  }

  const dueAt = parseOptionalLocalDateTime(form.get("dueAt"));
  if (!dueAt.ok) return { error: fail(400, { error: copy.errorInvalidDueAt }) };
  const priority = parseTodoPriorityInput(form.get("priority"));
  if (!priority.ok) {
    return { error: fail(400, { error: copy.errorInvalidPriority }) };
  }

  return {
    form,
    todo: {
      content: content || null,
      dueAt: dueAt.value,
      priority: priority.value,
      title,
    },
  };
}
