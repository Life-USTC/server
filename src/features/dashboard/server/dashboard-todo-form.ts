import { fail } from "@sveltejs/kit";
import {
  parseOptionalLocalDateTime,
  TODO_CONTENT_MAX_LENGTH,
  TODO_PRIORITIES,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/dashboard/server/dashboard-page-server";

type TodoActionCopy = {
  errorContentTooLong: string;
  errorInvalidDueAt: string;
  errorTitleRequired: string;
  errorTitleTooLong: string;
};

function todoPriorityFromForm(value: FormDataEntryValue | null) {
  const priorityRaw = String(value ?? "medium");
  return (TODO_PRIORITIES.has(priorityRaw) ? priorityRaw : "medium") as
    | "low"
    | "medium"
    | "high";
}

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

  return {
    form,
    todo: {
      content: content || null,
      dueAt: dueAt.value,
      priority: todoPriorityFromForm(form.get("priority")),
      title,
    },
  };
}
