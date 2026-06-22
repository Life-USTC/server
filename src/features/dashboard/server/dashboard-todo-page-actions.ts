import { fail, redirect } from "@sveltejs/kit";
import { getDashboardUserId } from "@/features/dashboard/server/dashboard-page-server";
import {
  createTodo,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import { getDashboardActionCopy } from "./dashboard-action-copy";
import type { DashboardPageLoadEvent } from "./dashboard-page-load-types";
import { readTodoForm } from "./dashboard-todo-form";

type DashboardActionEvent = Pick<DashboardPageLoadEvent, "locals" | "request">;

export async function createTodoDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale).todos;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });

  const parsed = await readTodoForm(request, copy);
  if ("error" in parsed) return parsed.error;

  await createTodo({ userId, ...parsed.todo });
  throw redirect(303, "/dashboard/todos");
}

export async function updateTodoDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale).todos;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });

  const parsed = await readTodoForm(request, copy);
  if ("error" in parsed) return parsed.error;

  const id = String(parsed.form.get("id") ?? "").trim();
  if (!id) return fail(400, { error: copy.saveFailed });

  const result = await updateOwnedTodo({
    id,
    userId,
    data: {
      ...parsed.todo,
      hasContent: true,
      hasDueAt: true,
    },
  });
  if (!result.ok) return fail(400, { error: copy.saveFailed });
  throw redirect(303, "/dashboard/todos");
}
