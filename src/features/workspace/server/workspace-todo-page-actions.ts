import { fail, redirect } from "@sveltejs/kit";
import {
  createTodo,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import { getWorkspaceUserId } from "@/features/workspace/server/workspace-page-server";
import { getWorkspaceActionCopy } from "./workspace-action-copy";
import type { WorkspacePageLoadEvent } from "./workspace-page-load-types";
import { readTodoForm } from "./workspace-todo-form";

type WorkspaceActionEvent = Pick<WorkspacePageLoadEvent, "locals" | "request">;

export async function createTodoWorkspaceAction({
  locals,
  request,
}: WorkspaceActionEvent) {
  const copy = getWorkspaceActionCopy(locals.locale).todos;
  const userId = await getWorkspaceUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });

  const parsed = await readTodoForm(request, copy);
  if ("error" in parsed) return parsed.error;

  await createTodo({ userId, ...parsed.todo });
  throw redirect(303, "/workspace/todos");
}

export async function updateTodoWorkspaceAction({
  locals,
  request,
}: WorkspaceActionEvent) {
  const copy = getWorkspaceActionCopy(locals.locale).todos;
  const userId = await getWorkspaceUserId(request);
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
  throw redirect(303, "/workspace/todos");
}
