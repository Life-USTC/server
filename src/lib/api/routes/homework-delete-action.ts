import { deleteHomework } from "@/features/homeworks/server/homework-mutations";
import {
  forbidden,
  jsonResponse,
  notFound,
  suspensionForbidden,
} from "@/lib/api/helpers";

export async function deleteHomeworkAction(id: string, userId: string) {
  const result = await deleteHomework({ homeworkId: id, userId });
  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    if (result.error === "suspended") {
      return suspensionForbidden("reason" in result ? result.reason : null);
    }
    return forbidden();
  }

  return jsonResponse({ success: true });
}
