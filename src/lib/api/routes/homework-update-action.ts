import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { requireHomeworkItemById } from "@/features/homeworks/server/homework-read-model";
import type { AppLocale } from "@/i18n/config";
import {
  badRequest,
  forbidden,
  jsonResponse,
  notFound,
} from "@/lib/api/helpers";
import { parseUpdateHomeworkInput } from "@/lib/api/routes/homework-mutation-helpers";

export async function updateHomeworkAction(
  id: string,
  userId: string,
  locale: AppLocale,
  parsedBody: Parameters<typeof parseUpdateHomeworkInput>[0],
) {
  const parsedUpdate = parseUpdateHomeworkInput(parsedBody, userId);
  if (parsedUpdate instanceof Response) return parsedUpdate;

  const result = await updateHomework({
    homeworkId: id,
    update: parsedUpdate,
    userId,
  });
  if (!result.ok) {
    if (result.error === "no_changes") return badRequest("No changes");
    if (result.error === "not_found") return notFound();
    if (result.error === "deleted") return forbidden("Homework deleted");
    return forbidden();
  }

  const homework = await requireHomeworkItemById({
    homeworkId: id,
    locale,
    userId,
  });

  return jsonResponse({ success: true, homework });
}
