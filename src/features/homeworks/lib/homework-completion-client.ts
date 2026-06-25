import type * as z from "zod";
import { apiClient, apiErrorMessage } from "@/lib/api/client";
import { homeworkCompletionResponseSchema } from "@/lib/api/schemas/homeworks-response-schemas";

export type HomeworkCompletionResult = z.infer<
  typeof homeworkCompletionResponseSchema
>;

type HomeworkCompletionState = {
  completion?: unknown | null;
};

export function applyHomeworkCompletionResult<
  Homework extends HomeworkCompletionState,
>(homework: Homework, result: HomeworkCompletionResult): Homework {
  return {
    ...homework,
    completion: result.completed
      ? { completedAt: result.completedAt ?? new Date().toISOString() }
      : null,
  } as Homework;
}

function parseCompletionPayload(payload: unknown, fallbackMessage: string) {
  const parsed = homeworkCompletionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(fallbackMessage);
  }

  return parsed.data;
}

export async function updateHomeworkCompletion(input: {
  completed: boolean;
  fallbackMessage: string;
  homeworkId: number | string;
}): Promise<HomeworkCompletionResult> {
  const result = await apiClient.PUT(
    `/api/homeworks/${input.homeworkId}/completion`,
    { body: { completed: input.completed } },
  );

  if (!result.response.ok) {
    throw new Error(apiErrorMessage(result.error, input.fallbackMessage));
  }

  return parseCompletionPayload(result.data, input.fallbackMessage);
}
