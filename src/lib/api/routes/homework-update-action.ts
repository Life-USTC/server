import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { forbidden, jsonResponse, notFound } from "@/lib/api/helpers";
import { parseUpdateHomeworkInput } from "@/lib/api/routes/homework-mutation-helpers";

export async function updateHomeworkAction(
  id: string,
  userId: string,
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
    if (result.error === "not_found") return notFound();
    return forbidden("Homework deleted");
  }

  return jsonResponse({ success: true });
}
