import { fail, redirect } from "@sveltejs/kit";
import { getDashboardUserId } from "@/features/dashboard/server/dashboard-page-server";
import type { AppLocale } from "@/i18n/config";
import { getDashboardActionCopy } from "./dashboard-action-copy";
import type { DashboardPageLoadEvent } from "./dashboard-page-load-types";
import { readTodoForm } from "./dashboard-todo-form";

type DashboardActionEvent = Pick<DashboardPageLoadEvent, "locals" | "request">;

export async function createTodoDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale as AppLocale).todos;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });

  const parsed = await readTodoForm(request, copy);
  if ("error" in parsed) return parsed.error;

  const { prisma } = await import("@/lib/db/prisma");
  await prisma.todo.create({
    data: {
      userId,
      ...parsed.todo,
    },
  });
  throw redirect(303, "/dashboard/todos");
}

export async function updateTodoDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale as AppLocale).todos;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });

  const parsed = await readTodoForm(request, copy);
  if ("error" in parsed) return parsed.error;

  const id = String(parsed.form.get("id") ?? "").trim();
  if (!id) return fail(400, { error: copy.saveFailed });

  const { prisma } = await import("@/lib/db/prisma");
  await prisma.todo.updateMany({
    where: { id, userId },
    data: parsed.todo,
  });
  throw redirect(303, "/dashboard/todos");
}

export async function toggleTodoDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale as AppLocale).todos;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const completed = String(form.get("completed") ?? "") === "true";
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.todo.updateMany({
    where: { id, userId },
    data: { completed },
  });
  throw redirect(303, "/dashboard/todos");
}

export async function deleteTodoDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale as AppLocale).todos;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.saveFailed });
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.todo.deleteMany({ where: { id, userId } });
  throw redirect(303, "/dashboard/todos");
}
