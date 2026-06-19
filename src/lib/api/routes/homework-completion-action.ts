import { setHomeworkCompletion } from "@/features/homeworks/server/homework-completion";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function updateHomeworkCompletionAction(input: {
  completed: boolean;
  homeworkId: string;
  userId: string;
}) {
  const result = await setHomeworkCompletion(input);
  if (!result.success) {
    return notFound();
  }

  return jsonResponse({
    completed: result.completed,
    completedAt: result.completedAt,
  });
}
