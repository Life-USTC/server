import { deleteHomework } from "@/features/homeworks/server/homework-mutations";
import { forbidden, jsonResponse, notFound } from "@/lib/api/helpers";

export async function deleteHomeworkAction(id: string, userId: string) {
  const result = await deleteHomework({ homeworkId: id, userId });
  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    return forbidden();
  }

  return jsonResponse({ success: true });
}
